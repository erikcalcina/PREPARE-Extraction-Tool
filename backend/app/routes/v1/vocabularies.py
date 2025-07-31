from fastapi import APIRouter
from app.utils.fake_db import fake_vocabularies_db
from app.library.vocabulary_service import VocabularyService

router = APIRouter(
    tags=["Vocabularies"]
)

service = VocabularyService(fake_vocabularies_db)

router.post("/", status_code=201)(service.create_vocabulary)
router.get("/")(service.get_vocabularies)
router.get("/{vocabulary_id}")(service.get_specific_vocabulary)
router.delete("/{vocabulary_id}", status_code=204)(service.delete_vocabulary)
router.post("/{vocabulary_id}/concepts", status_code=201)(service.add_concept)
router.get("/{vocabulary_id}/concepts")(service.get_concepts)
router.get("/{vocabulary_id}/concepts/{concept_id}")(service.get_specific_concept)
router.delete("/{vocabulary_id}/concepts/{concept_id}", status_code=204)(service.delete_concept)