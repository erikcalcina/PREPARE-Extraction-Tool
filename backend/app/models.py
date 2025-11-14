from typing import List

from sqlmodel import SQLModel, Field


class UserModel(SQLModel):
    name: str
    password: str

class MessageOutput(SQLModel):
    message: str

class SourceTermCreate(SQLModel):
    value: str
    label: str

class ConceptCreate(SQLModel):
    vocab_term_id: str
    vocab_term_name: str

class VocabularyCreate(SQLModel):
    name: str
    version: str
    concepts: List[ConceptCreate] = Field(default_factory=list)

class RecordCreate(SQLModel):
    text: str

class DatasetCreate(SQLModel):
    name: str
    labels: List[str] = Field(default_factory=list)
    records: List[RecordCreate] = Field(default_factory=list)


class ClusteredTerm(SQLModel):
    """
    One term variant inside a cluster.
 one row in the "Clustered terms" table
    in the UI: the text itself, how often it appears and in which revords ?
    """
    term_id: int               # ID of SourceTerm in the database
    text: str                  # The actual term text (SourceTerm.value)
    frequency: int             # How many times this text appears in all SourceTerms
    n_records: int             # In how many distinct records this text appears
    record_ids: List[int]      # IDs of records that contain this text


class EntityCluster(SQLModel):
    """
    One cluster of similar terms (entities). Example:
      label = "Diagnosis"
      main_term = "ruptura LCA"
      terms = all different spellings or languages of the same idea.
    """
    id: int                    # Cluster index (0....)
    main_term: str             # Suggested main/representative term
    label: str                 # Entity label/category (diagnosis, operation...)

    total_terms: int           # How many different term variants in this cluster
    total_occurrences: int     # Sum of frequencies of all terms in this cluster
    n_records: int             # In how many records any term from this cluster appears

    terms: List[ClusteredTerm] = Field(default_factory=list)