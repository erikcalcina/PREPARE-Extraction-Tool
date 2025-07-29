from app.routes.v1 import login, vocabularies, datasets, source_term

routers = [
    (login.router, "/api/v1/login", ["Login"]),
    (vocabularies.router, "/api/v1/vocabularies", ["Vocabularies"]),
    (datasets.router, "/api/v1/datasets", ["Datasets"]),
    (source_term.router, "/api/v1/source-term", ["Source Term"]),
]
