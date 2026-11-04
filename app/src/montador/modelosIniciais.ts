import { criarBloco, VERSAO_MONTADOR, type Largura, type Rascunho, type TemaDoMontador } from '../dominio/montador';

export type ChaveModeloInicial = 'emBranco' | 'lista' | 'formulario' | 'ficha';

export const MODELOS_INICIAIS: readonly { chave: ChaveModeloInicial; rotulo: string; detalhe: string }[] = [
  { chave: 'emBranco', rotulo: 'Novo em branco', detalhe: 'Prancheta limpa para começar do zero' },
  { chave: 'lista', rotulo: 'Lista', detalhe: 'Cabeçalho + busca simulada + cartão com lista de linhas' },
  { chave: 'formulario', rotulo: 'Formulário', detalhe: 'Cabeçalho + dois cartões com campos + linha de botões' },
  { chave: 'ficha', rotulo: 'Ficha', detalhe: 'Cabeçalho + grade de cartões com campos só leitura' },
];

export function criarRascunhoDeModelo(
  chave: ChaveModeloInicial,
  largura: Largura = 1280,
  tema: TemaDoMontador = 'claro',
): Rascunho {
  switch (chave) {
    case 'emBranco':
      return {
        versao: VERSAO_MONTADOR,
        nome: 'Novo rascunho',
        largura,
        tema,
        blocos: [],
      };
    case 'lista':
      return {
        versao: VERSAO_MONTADOR,
        nome: 'Lista de alunos',
        largura,
        tema,
        blocos: [
          criarBloco('cabecalho', { titulo: 'Alunos', subtitulo: 'Acompanhamento e planos em uso' }),
          criarBloco('campo', { rotulo: 'Buscar por nome ou e-mail', valor: '', ajuda: '', erro: '', linhas: 1 }),
          criarBloco(
            'cartao',
            { titulo: 'Para revisar', descricao: '3 alunos aguardando revisão', recolhivel: false, faixa: true },
            [
              criarBloco('listaDeLinhas', { emColunas: false }, [
                criarBloco('linha', {
                  titulo: 'Ana Carolina Souza',
                  metadados: 'Treino A/B/C · Enviada hoje',
                  descricao: '',
                  selos: 'Para revisar;atencao',
                }),
                criarBloco('linha', {
                  titulo: 'Bruno Henrique Lima',
                  metadados: 'Força 4x · Enviada ontem',
                  descricao: '',
                  selos: 'Para revisar;atencao',
                }),
                criarBloco('linha', {
                  titulo: 'Camila Rocha',
                  metadados: 'Hipertrofia · Último registro hoje',
                  descricao: '',
                  selos: 'Em dia;sucesso',
                }),
              ]),
            ],
          ),
        ],
      };
    case 'formulario':
      return {
        versao: VERSAO_MONTADOR,
        nome: 'Formulário de cadastro',
        largura,
        tema,
        blocos: [
          criarBloco('cabecalho', { titulo: 'Novo aluno', subtitulo: 'Preencha os dados iniciais da consultoria' }),
          criarBloco('cartao', { titulo: 'Identificação', descricao: '', recolhivel: false, faixa: true }, [
            criarBloco('campo', { rotulo: 'Nome completo', valor: 'Ana Carolina Souza', ajuda: '', erro: '', linhas: 1 }),
            criarBloco('campo', { rotulo: 'E-mail', valor: 'ana@exemplo.com', ajuda: '', erro: '', linhas: 1 }),
          ]),
          criarBloco('cartao', { titulo: 'Acompanhamento', descricao: '', recolhivel: false, faixa: true }, [
            criarBloco('escolha', {
              rotulo: 'Modalidade',
              opcoes: 'Presencial\nOnline\nHíbrido',
              selecionada: 'Online',
            }),
            criarBloco('interruptor', { rotulo: 'Enviar convite de acesso ao salvar', ligado: true }),
          ]),
          criarBloco('linhaDeBotoes', {}, [
            criarBloco('botao', {
              rotulo: 'Cancelar',
              tipo: 'secundario',
              desabilitado: false,
              motivo: '',
              cheio: false,
            }),
            criarBloco('botao', {
              rotulo: 'Salvar aluno',
              tipo: 'primario',
              desabilitado: false,
              motivo: '',
              cheio: false,
            }),
          ]),
        ],
      };
    case 'ficha':
      return {
        versao: VERSAO_MONTADOR,
        nome: 'Ficha do aluno',
        largura,
        tema,
        blocos: [
          criarBloco('cabecalho', {
            titulo: 'Ana Carolina Souza',
            subtitulo: 'Plano Hipertrofia · Ciclo atual até 30/11',
          }),
          criarBloco('grade', {}, [
            criarBloco('cartao', { titulo: 'Cadastro', descricao: '', recolhivel: false, faixa: true }, [
              criarBloco('campoLeitura', { rotulo: 'E-mail', valor: 'ana@exemplo.com' }),
              criarBloco('campoLeitura', { rotulo: 'Telefone', valor: '(45) 99999-0000' }),
            ]),
            criarBloco('cartao', { titulo: 'Acompanhamento', descricao: '', recolhivel: false, faixa: true }, [
              criarBloco('campoLeitura', { rotulo: 'Objetivo', valor: 'Hipertrofia e condicionamento' }),
              criarBloco('campoLeitura', { rotulo: 'Ciclo de atualização', valor: '15 dias' }),
            ]),
          ]),
        ],
      };
  }
}
