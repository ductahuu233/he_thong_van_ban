import pytest
import os
from docxtpl import DocxTemplate
from docx import Document

# Sample data for rendering
sample_data = {
    "title": "Báo cáo cuối cùng",
    "name": "Nguyễn Văn A",
    "items": [
        {"id": 1, "description": "Mục 1", "quantity": 10, "price": 100},
        {"id": 2, "description": "Mục 2", "quantity": 5, "price": 50},
    ]
}

def test_render_docx_template(tmp_path):
    """
    Tests the rendering of a docx template using docxtpl with sample data,
    verifying direct field replacement and table iteration.
    """
    template_path = os.path.join("data", "template_congvan.docx")
    output_file_name = "rendered_congvan_test.docx"
    output_path = tmp_path / output_file_name

    # Check if the template file exists
    assert os.path.exists(template_path), f"Template file not found at {template_path}"

    # Render the document
    doc = DocxTemplate(template_path)
    doc.render(sample_data)
    doc.save(output_path)

    # Verify the output file exists
    assert os.path.exists(output_path)

    # Open the rendered document and verify its content
    document = Document(output_path)
    full_text = []
    for paragraph in document.paragraphs:
        full_text.append(paragraph.text)
    for table in document.tables:
        for row in table.rows:
            for cell in row.cells:
                full_text.append(cell.text)
    
    document_content = "\n".join(full_text)

    # Verify direct field replacement
    assert sample_data["title"] in document_content
    assert sample_data["name"] in document_content

    # Verify table iteration (check for descriptions of items)
    for item in sample_data["items"]:
        assert item["description"] in document_content
        # You might also want to check for other fields like quantity or price if they are expected to be rendered in tables
        assert str(item["quantity"]) in document_content
        assert str(item["price"]) in document_content

    # Optionally, you can add more specific checks if you know the exact structure
    # For example, if you expect "Mục 1" to be in a specific table cell.
