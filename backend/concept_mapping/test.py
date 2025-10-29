from sentence_transformers import SentenceTransformer

concept = "Coronary artery disease"
model = SentenceTransformer("neuml/pubmedbert-base-embeddings")
embeddings = model.encode(concept).tolist()
print(len(embeddings))