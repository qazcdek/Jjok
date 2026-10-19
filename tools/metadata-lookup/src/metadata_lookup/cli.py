from jjok_toolkit import run_cli

from . import __version__
from .core import run
from .models import Input, Output


def main() -> None:
    run_cli(
        name="metadata-lookup",
        version=__version__,
        input_model=Input,
        output_model=Output,
        handler=lambda inp: run(inp),
    )


if __name__ == "__main__":
    main()
