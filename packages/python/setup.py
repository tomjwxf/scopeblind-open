from setuptools import setup, find_packages

setup(
    name="scopeblind",
    version="0.1.0",
    packages=find_packages(),
    install_requires=[
        "requests",
        "cryptography",
    ],
    author="ScopeBlind",
    description="Python SDK for ScopeBlind privacy-preserving rate limiting",
    long_description=open("README.md").read() if open("README.md").exists() else "",
    long_description_content_type="text/markdown",
)
