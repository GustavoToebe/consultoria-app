import zipfile
import xml.etree.ElementTree as ET
import json

z = zipfile.ZipFile('docs/memento.xlsx')
shared = []
if 'xl/sharedStrings.xml' in z.namelist():
    tree = ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in tree.findall('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}si'):
        shared.append(''.join(t.text or '' for t in si.iter('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}t')))

s7 = ET.fromstring(z.read('xl/worksheets/sheet7.xml'))
rels = ET.fromstring(z.read('xl/worksheets/_rels/sheet7.xml.rels'))
rel_map = {r.attrib['Id']: r.attrib.get('Target') for r in rels}

hlinks = s7.find('{http://schemas.openxmlformats.org/spreadsheetml/2006/main}hyperlinks')
cell_url = {}
if hlinks is not None:
    for h in hlinks:
        r_id = h.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id')
        cell_url[h.attrib.get('ref')] = rel_map.get(r_id)

result = {}
ns = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
for row in s7.findall(f'{ns}sheetData/{ns}row'):
    r_idx = row.attrib['r']
    d_cell = row.find(f'{ns}c[@r="D{r_idx}"]')
    e_ref = f'E{r_idx}'
    if d_cell is not None and e_ref in cell_url:
        v = d_cell.find(f'{ns}v')
        if v is not None and v.text:
            idx = int(v.text)
            name = shared[idx] if idx < len(shared) else ''
            url = cell_url[e_ref]
            if name and url:
                result[name.strip()] = url

print(json.dumps(result, indent=2, ensure_ascii=False))
with open('docs/exercise_videos.json', 'w', encoding='utf-8') as f:
    json.dump(result, f, indent=2, ensure_ascii=False)
