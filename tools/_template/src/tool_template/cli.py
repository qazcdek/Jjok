from jjok_toolkit import run_cli

from . import __version__
from .core import Input, Output, run


def main() -> None:
    run_cli(
        name="tool-template",
        version=__version__,
        input_model=Input,
        output_model=Output,
        handler=run,
    )


if __name__ == "__main__":
    main()
