from venv import logger


from fastapi import APIRouter, Depends
from sqlmodel import Session, delete, select

from app.core.database import get_session
from app.models_db import ModelArtifact, TrainingEvaluation, TrainingRun, TrainingMetric
from app.services.websocket_manager import manager

router = APIRouter()


@router.post("/internal/training-events2")
async def training_event2(payload: dict, db: Session = Depends(get_session)):
    event_type = payload["type"]
    run_id = payload["run_id"]

    if event_type == "epoch_update":
        db.add(TrainingMetric(
            run_id=run_id,
            epoch=payload.get("epoch", 0),
            loss=payload.get("loss", 0),
            f1=payload.get("f1", 0),
            precision=payload.get("precision", 0),
            recall=payload.get("recall", 0),
        ))
        db.commit()

    elif event_type == "completed":
        run = db.get(TrainingRun, run_id)
        if run:
            run.status = "completed"
            run.output_model_path = payload.get("output_path")
            db.add(run)
            db.commit()

    elif event_type == "failed":
        run = db.get(TrainingRun, run_id)
        if run:
            run.status = "failed"
            db.add(run)
            db.commit()

    await manager.broadcast(payload)

    return {"ok": True}


@router.post("/internal/training-events")
async def receive_training_event(
    payload: dict,
    db: Session = Depends(get_session),
):
    logger.info(f"[EVENT RECEIVED] {payload}")
    event_type = payload.get("type")
    run_id = payload.get("run_id")

    if not run_id:
        return {"ok": False, "error": "missing run_id"}

    run = db.get(TrainingRun, run_id)

    # --------------------------
    # TRAINING INFO
    # --------------------------
    if event_type == "training_info":
        if run:
            run.status = "running"
            db.add(run)
            db.commit()

    # --------------------------
    # METRICS
    # --------------------------
    elif event_type == "epoch_update":
        epoch = payload.get("epoch")

        # 🔥 only store if this is a REAL metric event
        # (loss-only logs are NOT DB rows)
        #if payload.get("f1") is None and payload.get("precision") is None and payload.get("recall") is None:
        #    return

        db.add(
            TrainingMetric(
                run_id=run_id,
                epoch=epoch or 0,
                loss=payload.get("loss"),
                f1=payload.get("f1"),
                precision=payload.get("precision"),
                recall=payload.get("recall"),
            )
        )
        db.commit()

    # --------------------------
    # MODEL SAVED (SAFE UPSERT)
    # --------------------------
    elif event_type == "model_saved":
        model_path = payload.get("output_path")
        if model_path:
            existing = db.exec(
                select(ModelArtifact).where(
                    ModelArtifact.run_id == run_id,
                    ModelArtifact.model_path == model_path,
                )
            ).first()
            if not existing:
                # get evaluation metrics
                evaluation = db.exec(
                    select(TrainingEvaluation).where(
                        TrainingEvaluation.run_id == run_id
                    )
                ).first()
                db.add(
                    ModelArtifact(
                        run_id=run_id,
                        dataset_id=run.dataset_id if run else None,
                        model_path=model_path,
                        # required DB fields
                        f1_score=evaluation.f1 if evaluation else 0.0,
                        precision=evaluation.precision if evaluation else 0.0,
                        recall=evaluation.recall if evaluation else 0.0,
                        engine=payload.get("engine", "gliner"),
                    )
                )
                db.commit()

    # =========================
    # 4. EVALUATION (IMPORTANT FIX)
    # =========================

    elif event_type == "evaluation_completed":
        metrics = payload.get("metrics") or {}
        per_label = metrics.get("per_label") or {}

        f1 = metrics.get("f1_score") or 0.0
        precision = metrics.get("precision") or 0.0
        recall = metrics.get("recall") or 0.0

        # delete previous evaluation safely
        db.execute(
            delete(TrainingEvaluation).where(
                TrainingEvaluation.run_id == run_id
            )
        )

        db.add(
            TrainingEvaluation(
                run_id=run_id,
                precision=precision,
                recall=recall,
                f1=f1,
                per_label=per_label,
            )
        )

        db.commit()

        # OPTIONAL: also update artifact if exists
        #artifact = db.exec(
        #    select(ModelArtifact).where(
        #        ModelArtifact.run_id == run_id
        #    )
        #).first()

        #if artifact:
        #    artifact.f1_score = f1
        #    artifact.precision = precision
        #    artifact.recall = recall
        #    db.commit()
 

    # --------------------------
    # COMPLETED
    # --------------------------
    elif event_type == "completed":
        if run:
            run.status = "completed"
            run.output_model_path = payload.get("output_path")
            db.add(run)
            db.commit()

    # --------------------------
    # FAILED
    # --------------------------
    elif event_type == "error":
        if run:
            run.status = "failed"
            db.add(run)
            db.commit()

    await manager.broadcast(payload)

    return {"ok": True}