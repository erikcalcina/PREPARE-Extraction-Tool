from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Middleware to add security headers to all responses.

    This middleware adds the following security headers:
    - X-Content-Type-Options: Prevents MIME type sniffing
    - X-Frame-Options: Prevents clickjacking attacks
    - X-XSS-Protection: Enables XSS filtering in older browsers
    - Strict-Transport-Security: Enforces HTTPS connections (only for HTTPS)
    - Referrer-Policy: Controls referrer information
    """

    async def dispatch(self, request: Request, call_next) -> Response:
        """
        Process the request and add security headers to the response.

        Args:
            request: The incoming request
            call_next: The next middleware or route handler

        Returns:
            Response with security headers added
        """
        response = await call_next(request)

        # Add security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Only add HSTS header for HTTPS connections
        # Check if the request was made over HTTPS
        if request.url.scheme == "https":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains"
            )

        return response
