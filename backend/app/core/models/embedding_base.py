from typing import Union, List


class BaseModel:
    """Base class for embedding models.

    This abstract base class defines the interface that all embedding models
    must implement. It provides a common structure for models that convert
    text into vector embeddings.

    Attributes:
        model_name_or_path (str): The name or path of the model.
    """

    def __init__(self, model_name_or_path: str):
        """Initialize the base model with a model name or path.

        Args:
            model_name_or_path (str): The name or file path of the model to load.
        """
        self.model_name_or_path = model_name_or_path

    def embed(
        self, text: Union[str, List[str]]
    ) -> Union[List[float], List[List[float]]]:
        """Convert text into vector embeddings.

        This method must be implemented by subclasses to provide the actual
        embedding functionality.

        Args:
            text (Union[str, List[str]]): A single text string or list of text
                strings to convert into embeddings.

        Returns:
            List[float]: The embedding vector(s) as a list of floats.

        Raises:
            NotImplementedError: This method must be implemented by subclasses.
        """
        raise NotImplementedError("Subclasses must implement this method")
