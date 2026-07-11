from .common import ResultRow, person_key
from .excel_parser import parse_excel_file
from .html_parser import parse_html_file
from .image_parser import parse_image_file
from .office_parser import parse_office_file
from .pdf_parser import parse_pdf_file
from .text_parser import parse_text_file

PARSERS = {
    ".html": parse_html_file,
    ".htm": parse_html_file,
    ".txt": parse_text_file,
    ".xls": parse_excel_file,
    ".xlsx": parse_excel_file,
    ".xlsm": parse_excel_file,
    ".ods": parse_excel_file,
    ".pdf": parse_pdf_file,
    ".doc": parse_office_file,
    ".docx": parse_office_file,
    ".rtf": parse_office_file,
    ".jpeg": parse_image_file,
    ".jpg": parse_image_file,
    ".png": parse_image_file,
}
