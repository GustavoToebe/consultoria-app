import zipfile
import xml.etree.ElementTree as ET
import csv
import os

def export_xlsx(filename):
    z = zipfile.ZipFile(filename)
    # Parse shared strings
    shared_strings = []
    if 'xl/sharedStrings.xml' in z.namelist():
        tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
        for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
            text = "".join(t.text or "" for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t'))
            shared_strings.append(text)

    # Parse workbook for sheet names and r:id
    wb_tree = ET.fromstring(z.read('xl/workbook.xml'))
    sheets_elem = wb_tree.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheets')
    
    # Parse rels
    rels_tree = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
    rel_map = {}
    for rel in rels_tree:
        rel_map[rel.attrib['Id']] = rel.attrib['Target']

    for sheet in sheets_elem:
        sheet_name = sheet.attrib['name']
        r_id = sheet.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']
        target_path = 'xl/' + rel_map[r_id]
        sheet_xml = ET.fromstring(z.read(target_path))
        
        rows_data = []
        sheet_data = sheet_xml.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}sheetData')
        if sheet_data is not None:
            for row in sheet_data.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}row'):
                row_cells = {}
                max_col = 0
                for c in row.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}c'):
                    r_ref = c.attrib.get('r', '')
                    col_str = "".join([ch for ch in r_ref if ch.isalpha()])
                    col_idx = 0
                    for ch in col_str:
                        col_idx = col_idx * 26 + (ord(ch.upper()) - ord('A') + 1)
                    col_idx -= 1
                    if col_idx > max_col:
                        max_col = col_idx

                    t_attr = c.attrib.get('t', '')
                    v_elem = c.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}v')
                    val = ""
                    if v_elem is not None and v_elem.text is not None:
                        val = v_elem.text
                        if t_attr == 's':
                            val = shared_strings[int(val)] if int(val) < len(shared_strings) else val
                    row_cells[col_idx] = val

                row_list = [row_cells.get(i, "") for i in range(max_col + 1)]
                rows_data.append(row_list)

        out_csv = os.path.join(os.path.dirname(filename), f"{sheet_name}.csv")
        with open(out_csv, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerows(rows_data)
        print(f"Exportado com sucesso: {out_csv} ({len(rows_data)} linhas)")

if __name__ == '__main__':
    export_xlsx('docs/memento.xlsx')
