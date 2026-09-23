"""Create a portable ZIP with POSIX paths for Linux App Service."""
import pathlib
import sys
import zipfile

source = pathlib.Path(sys.argv[1]).resolve()
target = pathlib.Path(sys.argv[2]).resolve()
with zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as archive:
    for file in sorted(source.rglob("*")):
        if file.is_file():
            archive.write(file, file.relative_to(source).as_posix())
print(f"ZIP pronto: {target.name}")
