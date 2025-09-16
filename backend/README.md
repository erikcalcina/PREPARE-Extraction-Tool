# Template API Service

This template is used to create a new API service. It uses the [FastAPI] framework.

## ☑️ Requirements

Before starting the project make sure these requires are available:

- [python]. For running the app (python version >= 3.10)
- [git]. For versioning the code.

## 🛠️ Setup

### Create a python environment

Run the following command to create a python environment:

```bash
# create a new virtual environment
python -m venv venv

# activate the environment (UNIX)
. ./venv/bin/activate

# activate the environment (WINDOWS)
./venv/Scripts/activate

# deactivate the environment (UNIX & WINDOWS)
deactivate
```

### Install the requirements

Run the following command to install the requirements:

```bash
pip install -e .[dev]
```

## 🏗️ Development

To start the app in development mode, run the following command in the terminal:

```bash
fastapi dev ./app/main.py --port 4000
```

This will start the app and listen it on port 4000.

### API Docs

To see the API documentation, visit either:

| URL                         | Description                                         |
| --------------------------- | --------------------------------------------------- |
| http://127.0.0.1:4000/docs  | Automatic iteractive API documentation (Swagger UI) |
| http://127.0.0.1:4000/redoc | Alternative automatic documentation (ReDoc)         |

## 🚀 Production

To start the app in production mode, run the following command in the terminal:

```bash
fastapi run ./app/main.py --port 4000
```

or, alternatively,

```bash
uvicorn app.main:app --host 127.0.0.1 --port 4000
```

## 🐳 Dockerize

To dockerize the app, run the following command in the terminal:

```bash
# build the docker image
docker build -t template .

# run the docker container
docker run -d --name template -p 4000:4000 template
```

To change the port, change the `4000` to your desired port.

[FastAPI]: https://fastapi.tiangolo.com/
[python]: https://www.python.org/
[git]: https://git-scm.com/
