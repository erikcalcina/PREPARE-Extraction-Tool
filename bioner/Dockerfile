# Start from the official Python base image
FROM python:3.10

# Set the current working directory to /code
WORKDIR /code

# Copy the file with the requirements to the /code directory
COPY ./requirements.txt /code/requirements.txt

# Install the package dependencies in the requirements file
RUN pip install --no-cache-dir --upgrade -r /code/requirements.txt

# Copy the ./app directory inside the /code directory
COPY ./app /code/app

# Set the command to run the lightning server
#, "--host", "0.0.0.0", "--port", "4000"
CMD ["python", "-m", "app.main", "--use_gpu"]