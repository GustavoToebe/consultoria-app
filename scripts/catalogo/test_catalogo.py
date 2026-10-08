"""Testes dos geradores do catálogo: python -m unittest scripts/catalogo/test_catalogo.py"""
import sys
import tempfile
import unittest
from decimal import Decimal
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import comum  # noqa: E402
import gerar_taco  # noqa: E402


def alimento(codigo, nome, kcal=100.0, proteina=1.0, gordura=1.0, carboidrato=1.0, grupo="Grupo"):
    return {"linha": codigo, "codigo": codigo, "nome": nome, "grupo": grupo,
            "brutos": {"kcal": kcal, "proteina": proteina, "gordura": gordura, "carboidrato": carboidrato}}


class ComumTest(unittest.TestCase):
    def test_normalizar_tira_acento_e_caixa(self):
        self.assertEqual(comum.normalizar("  Feijão,  PRETO "), "feijao, preto")
        self.assertEqual(comum.normalizar("Coração à milanesa"), "coracao a milanesa")

    def test_uuid_deterministico_igual_ao_md5_do_postgres(self):
        # select md5('catalogo-alimento:taco:1')::uuid
        self.assertEqual(comum.uuid_deterministico("catalogo-exercicio:Prancha"),
                         comum.uuid_deterministico("catalogo-exercicio:Prancha"))
        self.assertRegex(comum.uuid_deterministico("x"), r"^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
        self.assertNotEqual(comum.uuid_deterministico("a"), comum.uuid_deterministico("b"))

    def test_sql_texto_dobra_aspas(self):
        self.assertEqual(comum.sql_texto("Dobradinha d'água"), "'Dobradinha d''água'")
        self.assertEqual(comum.sql_texto(None), "null")


class MarcadoresTest(unittest.TestCase):
    def test_traco_vira_zero_e_fica_marcado(self):
        aceitos, descartados, contagem = gerar_taco.montar([alimento(1, "Alimento A", gordura="Tr")])
        self.assertEqual(descartados, [])
        self.assertEqual(aceitos[0]["valores"]["gordura"], Decimal("0.00"))
        self.assertEqual(aceitos[0]["tracos"], ["gordura"])
        self.assertEqual(contagem["traco"]["gordura"], 1)

    def test_na_vira_zero_sem_marcar_traco(self):
        aceitos, _, contagem = gerar_taco.montar([alimento(1, "Óleo", proteina="NA", carboidrato="NA")])
        self.assertEqual(aceitos[0]["valores"]["proteina"], Decimal("0.00"))
        self.assertEqual(aceitos[0]["tracos"], [])
        self.assertEqual(aceitos[0]["nas"], ["proteina", "carboidrato"])
        self.assertEqual(contagem["na"]["proteina"], 1)

    def test_sem_analise_descarta_o_alimento(self):
        for ruim in ("*", None, "-", "ND", "em análise"):
            aceitos, descartados, _ = gerar_taco.montar([alimento(1, "Alimento A", kcal=ruim)])
            self.assertEqual(aceitos, [], ruim)
            self.assertEqual(len(descartados), 1, ruim)
            self.assertIn("kcal", descartados[0]["motivo"])

    def test_virgula_decimal_em_texto(self):
        aceitos, _, _ = gerar_taco.montar([alimento(1, "Alimento A", proteina="2,5")])
        self.assertEqual(aceitos[0]["valores"]["proteina"], Decimal("2.50"))

    def test_valores_absurdos_sao_descartados(self):
        for campo, valor in (("kcal", 951.0), ("kcal", -5.0), ("gordura", 100.5), ("carboidrato", -0.2)):
            aceitos, descartados, _ = gerar_taco.montar([alimento(1, "Alimento A", **{campo: valor})])
            self.assertEqual(aceitos, [], f"{campo}={valor}")
            self.assertEqual(len(descartados), 1)

    def test_oleo_com_100g_de_gordura_e_884_kcal_entra(self):
        aceitos, _, _ = gerar_taco.montar([alimento(1, "Óleo", kcal=884.0, gordura=100.0)])
        self.assertEqual(len(aceitos), 1)

    def test_residuo_negativo_minusculo_do_carboidrato_vira_zero_e_fica_no_relatorio(self):
        aceitos, descartados, _ = gerar_taco.montar([alimento(1, "Peixe", carboidrato=-0.0266)])
        self.assertEqual(descartados, [])
        self.assertEqual(aceitos[0]["valores"]["carboidrato"], Decimal("0.00"))
        self.assertEqual(len(aceitos[0]["residuos"]), 1)

    def test_nome_duplicado_vai_para_o_relatorio(self):
        aceitos, descartados, _ = gerar_taco.montar([alimento(1, "Feijão"), alimento(2, " feijao ")])
        self.assertEqual([a["codigo"] for a in aceitos], [1])
        self.assertIn("duplicado", descartados[0]["motivo"])

    def test_nome_invalido_e_descartado(self):
        aceitos, descartados, _ = gerar_taco.montar([alimento(540, "L")])
        self.assertEqual(aceitos, [])
        self.assertIn("nome inválido", descartados[0]["motivo"])

    def test_arredonda_para_duas_casas(self):
        aceitos, _, _ = gerar_taco.montar([alimento(1, "Alimento A", kcal=123.53489250000001, proteina=2.585)])
        self.assertEqual(aceitos[0]["valores"]["kcal"], Decimal("123.53"))
        self.assertEqual(aceitos[0]["valores"]["proteina"], Decimal("2.59"))


class LeituraTest(unittest.TestCase):
    def test_le_grupos_e_alimentos_e_tira_nota_de_rodape(self):
        linhas = {
            2: {"A": "Número do"},
            4: {"A": "Cereais e derivados"},
            5: {"A": 1.0, "B": "Arroz,   integral, cozido", "D": 123.5, "F": 2.6, "G": 1.0, "I": 25.8},
            6: {"A": "Bebidas"},
            7: {"A": 474.0, "B": "Cerveja, pilsen 2", "D": 40.7, "F": "Tr", "G": "Tr", "I": 3.3},
            8: {"A": 540.0, "B": "Feijoada"},
            9: {"A": "Abreviações: g: grama", "B": "texto de rodapé"},
        }
        lidos = gerar_taco.ler_alimentos(linhas)
        self.assertEqual([a["codigo"] for a in lidos], [1, 474, 540])
        self.assertEqual(lidos[0]["nome"], "Arroz, integral, cozido")
        self.assertEqual(lidos[0]["grupo"], "Cereais e derivados")
        self.assertEqual(lidos[1]["nome"], "Cerveja, pilsen")
        self.assertEqual(lidos[1]["grupo"], "Bebidas")


class SqlTest(unittest.TestCase):
    def test_sql_escapa_aspas_e_e_estavel(self):
        aceitos, _, _ = gerar_taco.montar([alimento(1, "Dobradinha d'água", gordura="Tr"), alimento(2, "Alimento B")])
        sql = gerar_taco.gerar_sql(aceitos, "abc")
        self.assertIn("'Dobradinha d''água'", sql)
        self.assertIn("'gordura'", sql)
        self.assertIn("md5('catalogo-alimento:taco:1')::uuid", sql)
        self.assertEqual(sql, gerar_taco.gerar_sql(aceitos, "abc"))

    def test_nao_deixa_alimento_demonstracao(self):
        sql = gerar_taco.gerar_sql([], "abc")
        self.assertIn("delete from catalogo_alimento where fonte like 'Valores de demonstração%'", sql)


class ConferenciaTest(unittest.TestCase):
    def tokens(self, kcal="124", prot="2,6", lip="1,0", carb="25,8"):
        return ["70,1", kcal, "517", prot, lip, "NA", carb, "2,7", "0,5", "5", "59"]

    def test_valor_igual_ao_impresso_nao_diverge(self):
        a = alimento(1, "Arroz", kcal=123.53, proteina=2.588, gordura=1.0003, carboidrato=25.81)
        div, nomes, nao, conferidos = gerar_taco.conferir([a], {1: ("Arroz", self.tokens())})
        self.assertEqual((div, nomes, nao, conferidos), ([], [], [], 1))

    def test_valor_diferente_do_impresso_diverge(self):
        a = alimento(1, "Arroz", kcal=140.0, proteina=2.588, gordura=1.0, carboidrato=25.81)
        div, _, _, _ = gerar_taco.conferir([a], {1: ("Arroz", self.tokens())})
        self.assertEqual([d[2] for d in div], ["kcal"])

    def test_marcador_diferente_diverge(self):
        a = alimento(1, "Arroz", kcal=123.53, proteina="Tr", gordura=1.0, carboidrato=25.81)
        div, _, _, _ = gerar_taco.conferir([a], {1: ("Arroz", self.tokens())})
        self.assertEqual([d[2] for d in div], ["proteina"])

    def test_linha_incompleta_nao_e_conferida_e_nome_diferente_e_listado(self):
        a = alimento(1, "Arroz")
        div, nomes, nao, conferidos = gerar_taco.conferir([a], {1: ("Outro", ["70,1", "124"])})
        self.assertEqual(div, [])
        self.assertEqual(len(nomes), 1)
        self.assertEqual(len(nao), 1)
        self.assertEqual(conferidos, 0)

    def test_nota_de_rodape_no_pdf_e_ignorada(self):
        a = alimento(474, "Cerveja, pilsen", kcal=40.72, proteina=0.5625, gordura="Tr", carboidrato=3.3175)
        tokens = ["2", "92,4", "41", "170", "0,6", "Tr", "NA", "3,3", "0,1", "5", "7"]
        # umidade 92,4 | kcal 41 | kJ 170 | proteína 0,6 | lipídeos Tr | colesterol NA | carboidrato 3,3
        tokens = ["2", "92,4", "41", "170", "0,6", "Tr", "NA", "3,3", "NA", "0,1", "5", "7"]
        pdf = {474: ("Cerveja, pilsen", tokens)}
        div, _, _, conferidos = gerar_taco.conferir([a], pdf)
        self.assertEqual(conferidos, 1)
        self.assertEqual(div, [])


class PlanilhaTest(unittest.TestCase):
    def test_le_xlsx_real_da_taco(self):
        caminho = gerar_taco.PLANILHA
        if not caminho.exists():
            self.skipTest("planilha não está no repositório")
        alimentos = gerar_taco.ler_alimentos(comum.ler_planilha(caminho, 0))
        self.assertEqual(len(alimentos), 597)
        self.assertEqual(alimentos[0]["nome"], "Arroz, integral, cozido")
        self.assertEqual(alimentos[0]["grupo"], "Cereais e derivados")
        self.assertEqual(len({a["codigo"] for a in alimentos}), 597)

    def test_rodar_duas_vezes_gera_o_mesmo_sql(self):
        if not gerar_taco.PLANILHA.exists():
            self.skipTest("planilha não está no repositório")
        alimentos = gerar_taco.ler_alimentos(comum.ler_planilha(gerar_taco.PLANILHA, 0))
        aceitos, _, _ = gerar_taco.montar(alimentos)
        sha = comum.sha256(gerar_taco.PLANILHA)
        self.assertEqual(gerar_taco.gerar_sql(aceitos, sha), gerar_taco.SQL.read_text(encoding="utf-8"))
        with tempfile.TemporaryDirectory() as tmp:
            destino = Path(tmp) / "x.sql"
            comum.escrever(destino, "a\nb\n")
            self.assertEqual(destino.read_bytes(), b"a\nb\n")


if __name__ == "__main__":
    unittest.main()
