package br.com.treinos.api.contratos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.contratos.ContratoAluno.Origem;
import br.com.treinos.api.contratos.ContratoAluno.Signatario;
import br.com.treinos.api.contratos.ContratoAluno.Situacao;
import br.com.treinos.api.contratos.ContratoDtos.Assinatura;
import br.com.treinos.api.contratos.ContratoDtos.CancelarRequest;
import br.com.treinos.api.contratos.ContratoDtos.ContratoDetalhe;
import br.com.treinos.api.contratos.ContratoDtos.ContratoExportado;
import br.com.treinos.api.contratos.ContratoDtos.ContratoResumo;
import br.com.treinos.api.contratos.ContratoDtos.GerarContratoPdfRequest;
import br.com.treinos.api.contratos.ContratoDtos.Falta;
import br.com.treinos.api.contratos.ContratoDtos.GerarContratoRequest;
import br.com.treinos.api.contratos.ContratoDtos.LinkDoContrato;
import br.com.treinos.api.contratos.ContratoDtos.PreviaDoContrato;
import br.com.treinos.api.contratos.ContratoDtos.ProrrogarRequest;
import br.com.treinos.api.inscricoes.CodigoDeInscricao;
import br.com.treinos.api.pagamentos.PagamentosProperties;
import br.com.treinos.api.security.OpaqueTokenGenerator;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

/**
 * Contrato digital, lado da equipe (D1 a D23): gerar pelo modelo (que já é o envio, D23), prévia, ler, cancelar e prorrogar. O texto
 * preenchido é congelado no contrato e o hash o cobre (D22). Gerar é idempotente pelo {@code pedidoId}, depois da trava do aluno, como
 * a cobrança avulsa. Texto, CPF, IP e nome nunca vão a log, auditoria nem mensagem de erro (frases fixas, resumos fixos).
 */
@Service
public class ContratoService {

    static final int TITULO_MAXIMO = 120;
    static final int TEXTO_PREENCHIDO_MAXIMO = 100_000;
    static final int MOTIVO_MAXIMO = 300;
    static final int PRORROGAR_MAXIMO_DIAS = 60;
    /** 900 KB: o teto da coluna ({@code ck_contrato_arquivo_bytes}); o corpo da API tem 1 MiB. */
    static final int PDF_MAXIMO_BYTES = 921_600;

    private final ContratoAlunoRepository contratos;
    private final ContratoArquivoRepository arquivos;
    private final ContratoModeloService modelos;
    private final PreenchimentoDoContrato preenchimento;
    private final AlunoRepository alunos;
    private final ConsultoriaRepository consultorias;
    private final UsuarioRepository usuarios;
    private final Auditoria auditoria;
    private final PagamentosProperties pagamentos;

    public ContratoService(ContratoAlunoRepository contratos, ContratoArquivoRepository arquivos, ContratoModeloService modelos,
                           PreenchimentoDoContrato preenchimento, AlunoRepository alunos, ConsultoriaRepository consultorias,
                           UsuarioRepository usuarios, Auditoria auditoria, PagamentosProperties pagamentos) {
        this.contratos = contratos;
        this.arquivos = arquivos;
        this.modelos = modelos;
        this.preenchimento = preenchimento;
        this.alunos = alunos;
        this.consultorias = consultorias;
        this.usuarios = usuarios;
        this.auditoria = auditoria;
        this.pagamentos = pagamentos;
    }

    /** O que {@link #gerar} fez: {@code criado} é 201; repetido pelo mesmo {@code pedidoId} é 200 com o mesmo contrato. */
    public record Gerado(ContratoDetalhe contrato, boolean criado) { }

    // ---- prévia e gerar ----

    /**
     * O modelo preenchido para o aluno, sem gravar nada: o que ainda tem {@code {campo}} é o que falta, e {@code faltas} diz o quê.
     * Mesmas permissões e recusas do gerar, menos o pedido.
     */
    @Transactional(readOnly = true)
    public PreviaDoContrato previa(UUID alunoId, GerarContratoRequest r) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(ContratoService::alunoNaoEncontrado);
        Quem quem = quem(aluno, r.signatario());
        Preenchido p = preencher(aluno, r);
        List<Falta> faltas = juntar(p.resultado().faltas(), faltasDoResponsavel(aluno, quem));
        return new PreviaDoContrato(p.titulo(), p.texto(), faltas, faltas.isEmpty());
    }

    @Transactional
    public Gerado gerar(UsuarioAutenticado eu, UUID alunoId, GerarContratoRequest r) {
        return gerarDe(eu, alunoId, r.pedidoId(), aluno -> {
            Quem quem = quem(aluno, r.signatario());
            Preenchido p = preencher(aluno, r);
            exigirSemFaltas(juntar(p.resultado().faltas(), faltasDoResponsavel(aluno, quem)));
            String texto = TextoDoContrato.normalizar(p.texto());
            if (texto.length() > TEXTO_PREENCHIDO_MAXIMO) {
                throw invalido("texto", "O contrato preenchido passa de 100.000 caracteres. Encurte o modelo.");
            }
            return new Montado(r.contratacaoId(), Origem.MODELO, p.modeloId(), p.titulo(), texto, TextoDoContrato.sha256(texto),
                    prazoAte(p.prazoDias()), quem);
        }, null);
    }

    /**
     * Contrato de PDF próprio (D14, D22): o hash cobre os bytes como vieram (nada é reescrito), sem texto nem modelo; o resto é o
     * mesmo caminho do modelo. Arquivo vazio, sem {@code %PDF-} no começo ou acima de 900 KB, e título vazio ou longo, são 422
     * {@code CONTRATO_INVALIDO} com frase fixa (nunca o nome nem o conteúdo do arquivo).
     */
    @Transactional
    public Gerado gerarPdf(UsuarioAutenticado eu, UUID alunoId, GerarContratoPdfRequest r, byte[] pdf) {
        if (r == null) {
            throw invalido("dados", "Envie os dados do contrato.");
        }
        return gerarDe(eu, alunoId, r.pedidoId(), aluno -> {
            Quem quem = quem(aluno, r.signatario());
            String titulo = r.titulo() == null ? "" : r.titulo().strip();
            List<ApiError.FieldError> problemas = new ArrayList<>();
            if (pdf == null || pdf.length == 0 || !comecaComPdf(pdf)) {
                problemas.add(new ApiError.FieldError("arquivo", "Envie um arquivo PDF."));
            } else if (pdf.length > PDF_MAXIMO_BYTES) {
                problemas.add(new ApiError.FieldError("arquivo", "O PDF passa de 900 KB."));
            }
            if (titulo.isEmpty()) {
                problemas.add(new ApiError.FieldError("titulo", "Informe o título do contrato."));
            } else if (titulo.length() > TITULO_MAXIMO) {
                problemas.add(new ApiError.FieldError("titulo", "O título pode ter até " + TITULO_MAXIMO + " caracteres."));
            }
            if (!problemas.isEmpty()) {
                throw new ValidacaoException("Confira os dados do contrato.", "CONTRATO_INVALIDO", problemas);
            }
            if (r.contratacaoId() != null) {
                preenchimento.exigirContratacao(aluno, r.contratacaoId());
            }
            exigirSemFaltas(faltasDoResponsavel(aluno, quem));
            Consultoria consultoria = consultorias.findById(TenantContext.get())
                    .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
            Short dias = consultoria.getContratoPrazoDias();
            return new Montado(r.contratacaoId(), Origem.PDF, null, titulo, null, TextoDoContrato.sha256(pdf),
                    prazoAte(dias == null ? null : dias.intValue()), quem);
        }, pdf);
    }

    private static boolean comecaComPdf(byte[] pdf) {
        byte[] marca = "%PDF-".getBytes(StandardCharsets.US_ASCII);
        return pdf.length >= marca.length && Arrays.equals(pdf, 0, marca.length, marca, 0, marca.length);
    }

    /** Os bytes do PDF para a equipe (cancelado também: a equipe vê o histórico). Contrato de modelo ou sem arquivo = 404. */
    @Transactional(readOnly = true)
    public byte[] arquivo(UUID id) {
        ContratoAluno c = contratos.findById(id).orElseThrow(ContratoService::contratoNaoEncontrado);
        if (c.getOrigem() != Origem.PDF) {
            throw contratoNaoEncontrado();
        }
        return arquivos.findById(c.getId()).map(ContratoArquivo::getBytes).orElseThrow(ContratoService::contratoNaoEncontrado);
    }

    /**
     * O que os dois caminhos têm em comum: pedido obrigatório, trava consultoria → aluno, idempotência pelo {@code pedidoId} (depois
     * da trava), aluno ativo e não anonimizado, gravar, o PDF quando houver e a auditoria de resumo fixo.
     */
    private Gerado gerarDe(UsuarioAutenticado eu, UUID alunoId, UUID pedidoId, Function<Aluno, Montado> montar, byte[] pdf) {
        if (pedidoId == null) {
            throw invalido("pedidoId", "Informe o identificador do pedido.");
        }
        // A trava do aluno vem antes da consulta do pedido: de duas chamadas iguais ao mesmo tempo, a segunda espera e recebe o que a
        // primeira gerou (a mesma ordem da cobrança avulsa). A consultoria trava antes do aluno, na ordem do resto do código
        // (consultoria → aluno), para não dar deadlock com "Excluir minha conta".
        consultorias.travar(TenantContext.get());
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(ContratoService::alunoNaoEncontrado);
        var existente = contratos.findByPedidoId(pedidoId);
        if (existente.isPresent()) {
            ContratoAluno c = existente.get();
            // No PDF o reenvio só vale com o mesmo arquivo: outro arquivo no mesmo pedido ligaria o contrato ao PDF errado.
            boolean outroDocumento = pdf == null ? c.getOrigem() != Origem.MODELO
                    : c.getOrigem() != Origem.PDF || !c.getSha256().equals(TextoDoContrato.sha256(pdf));
            if (!c.getAlunoId().equals(alunoId) || outroDocumento) {
                throw new ConflictException("Este pedido já foi usado em outro contrato.", "PEDIDO_JA_USADO");
            }
            return new Gerado(detalhe(existente.get()), false);
        }
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative para gerar um contrato.", "ALUNO_INATIVO");
        }
        Montado m = montar.apply(aluno);
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        // O responsável assina por link (S5): o código só existe aqui e na resposta; no banco fica o hash.
        boolean comLink = m.quem() != Quem.ALUNO;
        String codigo = comLink ? CodigoDeInscricao.novo() : null;
        String hash = comLink ? OpaqueTokenGenerator.hash(codigo) : null;
        Instant linkExpiraEm = comLink ? validadeDoLink(m.prazoAte(), agora) : null;
        UUID grupo = m.quem() == Quem.PAR ? UUID.randomUUID() : null;
        ContratoAluno principal = switch (m.quem()) {
            case ALUNO -> novo(m, alunoId, Signatario.ALUNO, eu, pedidoId, null, null, null, agora);
            case RESPONSAVEL -> novo(m, alunoId, Signatario.RESPONSAVEL, eu, pedidoId, null, hash, linkExpiraEm, agora);
            case PAR -> novo(m, alunoId, Signatario.ALUNO, eu, pedidoId, grupo, null, null, agora);
        };
        ContratoAluno responsavel = m.quem() == Quem.PAR
                ? novo(m, alunoId, Signatario.RESPONSAVEL, eu, pedidoDoResponsavel(pedidoId), grupo, hash, linkExpiraEm, agora)
                : null;
        principal = gravar(principal, pdf);
        if (responsavel != null) {
            responsavel = gravar(responsavel, pdf);
        }
        ContratoAluno dono = responsavel != null ? responsavel : principal.getSignatario() == Signatario.RESPONSAVEL ? principal : null;
        LinkDoContrato link = dono == null ? null : new LinkDoContrato(dono.getId(), codigo, linkExpiraEm);
        return new Gerado(detalhe(principal, link), true);
    }

    private static ContratoAluno novo(Montado m, UUID alunoId, Signatario signatario, UsuarioAutenticado eu, UUID pedidoId, UUID grupo,
                                      String linkHash, Instant linkExpiraEm, Instant agora) {
        return new ContratoAluno(alunoId, m.contratacaoId(), m.origem(), m.modeloId(), m.titulo(), m.texto(), m.sha256(), signatario,
                m.prazoAte(), eu.usuarioId(), pedidoId, grupo, linkHash, linkExpiraEm, agora);
    }

    /** Grava o contrato (e o PDF, quando houver) e audita; o resumo é fixo, um evento por contrato criado. */
    private ContratoAluno gravar(ContratoAluno novo, byte[] pdf) {
        try {
            novo = contratos.saveAndFlush(novo);
        } catch (DataIntegrityViolationException e) {
            if (violou(e, "ux_contrato_pedido")) {
                throw new ConflictException("Este pedido já foi usado em outro contrato.", "PEDIDO_JA_USADO");
            }
            throw e;
        }
        if (pdf != null) {
            arquivos.saveAndFlush(new ContratoArquivo(novo.getId(), pdf));
        }
        auditoria.registrarEvento("CONTRATO_GERADO", "CONTRATO", novo.getId(), "Gerou um contrato para o aluno.");
        return novo;
    }

    /** O pedido do contrato do responsável no par: derivado do pedido do aluno, então reenviar o mesmo pedido cai nos dois. */
    static UUID pedidoDoResponsavel(UUID pedidoId) {
        return UUID.nameUUIDFromBytes((pedidoId + ":responsavel").getBytes(StandardCharsets.UTF_8));
    }

    /** O que o link do responsável vale (S5): até o prazo, se ele ainda está no futuro; senão 30 dias a partir de agora. */
    static Instant validadeDoLink(Instant prazoAte, Instant agora) {
        return prazoAte != null && prazoAte.isAfter(agora) ? prazoAte : agora.plus(30, ChronoUnit.DAYS);
    }

    /** Quem assina (S2): só o aluno, só o responsável (menor de 16, ou pedido) ou os dois (16 e 17 anos). */
    private enum Quem { ALUNO, RESPONSAVEL, PAR }

    /** O contrato já montado, antes de saber os signatários: o que os dois contratos do par repartem. */
    private record Montado(UUID contratacaoId, Origem origem, UUID modeloId, String titulo, String texto, String sha256,
                           Instant prazoAte, Quem quem) {
        @Override
        public String toString() {
            return "Montado[...]";
        }
    }

    /**
     * S2, decidido no servidor: com o financeiro ligado e a data de nascimento do aluno preenchida, menor de 16 só o responsável assina,
     * de 16 a 17 os dois; 18 ou mais, ou sem data, vale o pedido (padrão aluno). Com o financeiro desligado (o responsável mora lá, D12)
     * só o aluno assina e pedir o responsável é 409 {@code CONTRATO_RESPONSAVEL_INDISPONIVEL}.
     */
    private Quem quem(Aluno aluno, String pedido) {
        Signatario pedidoSig = signatario(pedido);
        if (!pagamentos.habilitado()) {
            if (pedidoSig == Signatario.RESPONSAVEL) {
                throw new ConflictException("O responsável só assina com o financeiro ligado.", "CONTRATO_RESPONSAVEL_INDISPONIVEL");
            }
            return Quem.ALUNO;
        }
        if (aluno.getDataNascimento() != null) {
            int idade = Period.between(aluno.getDataNascimento(), LocalDate.now(Fuso.BRASILIA)).getYears();
            if (idade < 16) {
                return Quem.RESPONSAVEL;
            }
            if (idade < 18) {
                return Quem.PAR;
            }
        }
        return pedidoSig == Signatario.RESPONSAVEL ? Quem.RESPONSAVEL : Quem.ALUNO;
    }

    /** Todo caminho com o responsável exige nome e CPF dele no cadastro (D11): sem eles não há como conferir quem assina. */
    private List<Falta> faltasDoResponsavel(Aluno aluno, Quem quem) {
        if (quem == Quem.ALUNO) {
            return List.of();
        }
        var responsavel = preenchimento.responsavelDoAluno(aluno);
        List<Falta> faltas = new ArrayList<>();
        if (responsavel.map(r -> r.nome()).filter(n -> n != null && !n.isBlank()).isEmpty()) {
            faltas.add(new Falta(CamposDoContrato.Campo.RESPONSAVEL_NOME.codigo(), "Falta o nome do responsável."));
        }
        if (responsavel.map(r -> r.cpf()).filter(c -> c != null && !c.isBlank()).isEmpty()) {
            faltas.add(new Falta(CamposDoContrato.Campo.RESPONSAVEL_CPF.codigo(), "Falta o CPF do responsável."));
        }
        return faltas;
    }

    /** As faltas do modelo e as do responsável, sem repetir o mesmo campo. */
    private static List<Falta> juntar(List<Falta> doModelo, List<Falta> doResponsavel) {
        List<Falta> todas = new ArrayList<>(doModelo);
        for (Falta f : doResponsavel) {
            if (todas.stream().noneMatch(x -> x.campo().equals(f.campo()))) {
                todas.add(f);
            }
        }
        return todas;
    }

    private static void exigirSemFaltas(List<Falta> faltas) {
        if (!faltas.isEmpty()) {
            throw new ValidacaoException("Faltam dados para preencher o contrato.", "CONTRATO_INCOMPLETO",
                    faltas.stream().map(f -> new ApiError.FieldError(f.campo(), f.mensagem())).toList());
        }
    }

    private record Preenchido(String titulo, String texto, UUID modeloId, Integer prazoDias, PreenchimentoDoContrato.Resultado resultado) {
        @Override
        public String toString() {
            return "Preenchido[...]";
        }
    }

    /** Modelo e título conferidos, campos preenchidos (o que falta fica como {@code {campo}} no texto). */
    private Preenchido preencher(Aluno aluno, GerarContratoRequest r) {
        if (r.modeloId() == null) {
            throw invalido("modeloId", "Escolha o modelo do contrato.");
        }
        ContratoModelo modelo = modelos.ativoOuErro(r.modeloId());
        String titulo = r.titulo() == null || r.titulo().isBlank() ? modelo.getNome() : r.titulo().strip();
        if (titulo.length() > TITULO_MAXIMO) {
            throw invalido("titulo", "O título pode ter até " + TITULO_MAXIMO + " caracteres.");
        }
        Consultoria consultoria = consultorias.findById(TenantContext.get())
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
        var resultado = preenchimento.montar(aluno, CamposDoContrato.usados(modelo.getTexto()), r.contratacaoId(), consultoria.getNome());
        Short dias = consultoria.getContratoPrazoDias();
        return new Preenchido(titulo, CamposDoContrato.preencher(modelo.getTexto(), resultado.valores()), modelo.getId(),
                dias == null ? null : dias.intValue(), resultado);
    }

    /** O signatário pedido (D1): ausente é o aluno; qualquer valor que não seja um dos dois nomes é 422. */
    private static Signatario signatario(String signatario) {
        if (signatario == null || signatario.isBlank() || "ALUNO".equals(signatario)) {
            return Signatario.ALUNO;
        }
        if ("RESPONSAVEL".equals(signatario)) {
            return Signatario.RESPONSAVEL;
        }
        throw invalido("signatario", "Escolha quem assina: o aluno ou o responsável.");
    }

    // ---- ler ----

    @Transactional(readOnly = true)
    public List<ContratoResumo> listar(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(ContratoService::alunoNaoEncontrado);
        Instant agora = Instant.now();
        return contratos.findByAlunoIdOrderByGeradoEmDescIdDesc(aluno.getId()).stream().map(c -> resumo(c, agora)).toList();
    }

    @Transactional(readOnly = true)
    public ContratoDetalhe obter(UUID id) {
        return detalhe(contratos.findById(id).orElseThrow(ContratoService::contratoNaoEncontrado));
    }

    // ---- cancelar e prorrogar ----

    /**
     * Só o pendente se cancela, com motivo (D15): assinado = 409 {@code CONTRATO_ASSINADO} (gera-se outro); já cancelado = 200 sem
     * auditoria. {@code versao} obrigatória. O motivo é texto do treinador: nunca em log nem em auditoria, e o aluno não o vê.
     */
    @Transactional
    public ContratoDetalhe cancelar(UUID id, CancelarRequest r) {
        List<ContratoAluno> grupo = travar(id);
        ContratoAluno c = grupo.stream().filter(x -> x.getId().equals(id)).findFirst().orElseThrow(ContratoService::contratoNaoEncontrado);
        if (c.getSituacao() == Situacao.CANCELADO) {
            return detalhe(c);
        }
        if (c.getSituacao() == Situacao.ASSINADO) {
            throw new ConflictException("Contrato assinado não se cancela. Gere outro contrato.", "CONTRATO_ASSINADO");
        }
        String motivo = r.motivo() == null ? "" : r.motivo().strip();
        if (motivo.isEmpty()) {
            throw invalido("motivo", "Informe o motivo do cancelamento.");
        }
        if (motivo.length() > MOTIVO_MAXIMO) {
            throw invalido("motivo", "O motivo pode ter até " + MOTIVO_MAXIMO + " caracteres.");
        }
        exigirVersao(c, r.versao());
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        // Par aluno + responsável (S1): cancelar vale para os pendentes do grupo; o assinado nunca muda (D15).
        for (ContratoAluno x : grupo) {
            if (x.getSituacao() == Situacao.PENDENTE) {
                x.cancelar(motivo, agora);
                salvar(x);
                auditoria.registrarEvento("CONTRATO_CANCELADO", "CONTRATO", x.getId(), "Cancelou um contrato pendente.");
            }
        }
        return detalhe(c);
    }

    /** O contrato e, se ele tem grupo, os irmãos, todos travados de uma vez em ordem de id (sem trava em cruz entre duas chamadas). */
    private List<ContratoAluno> travar(UUID id) {
        UUID grupo = contratos.grupoDe(id).orElse(null);
        if (grupo == null) {
            return List.of(contratos.buscarParaAlterar(id).orElseThrow(ContratoService::contratoNaoEncontrado));
        }
        return contratos.buscarGrupoParaAlterar(grupo);
    }

    /**
     * Estende o prazo do pendente em {@code dias} (1 a 60) a partir do que for mais tarde, o fim do prazo atual ou hoje. Contrato sem
     * prazo (a consultoria não trava) = 409 {@code CONTRATO_SEM_PRAZO}; assinado ou cancelado = 409 {@code CONTRATO_NAO_PENDENTE}.
     */
    @Transactional
    public ContratoDetalhe prorrogar(UUID id, ProrrogarRequest r) {
        List<ContratoAluno> grupo = travar(id);
        ContratoAluno c = grupo.stream().filter(x -> x.getId().equals(id)).findFirst().orElseThrow(ContratoService::contratoNaoEncontrado);
        if (r.dias() == null || r.dias() < 1 || r.dias() > PRORROGAR_MAXIMO_DIAS) {
            throw invalido("dias", "Informe de 1 a " + PRORROGAR_MAXIMO_DIAS + " dias.");
        }
        if (c.getSituacao() != Situacao.PENDENTE) {
            throw new ConflictException("Só o contrato pendente tem prazo.", "CONTRATO_NAO_PENDENTE");
        }
        if (c.getPrazoAte() == null) {
            throw new ConflictException("Este contrato não tem prazo para assinar.", "CONTRATO_SEM_PRAZO");
        }
        exigirVersao(c, r.versao());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        LocalDate atual = c.getPrazoAte().atZone(Fuso.BRASILIA).toLocalDate();
        LocalDate base = atual.isAfter(hoje) ? atual : hoje;
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant novoPrazo = fimDoDia(base.plusDays(r.dias()));
        // Par (S1): o prazo vale para os pendentes do grupo e o link do responsável acompanha (S5); o assinado nunca muda.
        for (ContratoAluno x : grupo) {
            if (x.getSituacao() == Situacao.PENDENTE) {
                x.prorrogar(novoPrazo, agora);
                x.estenderLink(novoPrazo, agora);
                salvar(x);
                auditoria.registrarEvento("CONTRATO_PRAZO_PRORROGADO", "CONTRATO", x.getId(), "Prorrogou o prazo de um contrato.");
            }
        }
        return detalhe(c);
    }

    // ---- link do responsável ----

    /**
     * Gera um código novo para o link do responsável (S5): o anterior deixa de valer na hora e o novo só aparece nesta resposta. Só o
     * contrato {@code RESPONSAVEL} pendente tem link: de aluno 409 {@code CONTRATO_SEM_LINK}, assinado ou cancelado 409
     * {@code CONTRATO_NAO_PENDENTE}. A validade segue a regra do gerar (prazo no futuro, senão 30 dias).
     */
    @Transactional
    public LinkDoContrato renovarLink(UUID id) {
        ContratoAluno c = contratos.buscarParaAlterar(id).orElseThrow(ContratoService::contratoNaoEncontrado);
        if (c.getSignatario() != Signatario.RESPONSAVEL) {
            throw new ConflictException("Só o contrato do responsável tem link.", "CONTRATO_SEM_LINK");
        }
        if (c.getSituacao() != Situacao.PENDENTE) {
            throw new ConflictException("Só o contrato pendente tem link.", "CONTRATO_NAO_PENDENTE");
        }
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String codigo = CodigoDeInscricao.novo();
        Instant expiraEm = validadeDoLink(c.getPrazoAte(), agora);
        c.trocarLink(OpaqueTokenGenerator.hash(codigo), expiraEm, agora);
        salvar(c);
        auditoria.registrarEvento("CONTRATO_LINK_GERADO", "CONTRATO", id, "Gerou o link de assinatura de um contrato.");
        return new LinkDoContrato(id, codigo, expiraEm);
    }

    // ---- privacidade (LGPD) ----

    /** Exportação do aluno: todos os contratos com texto e evidências; o PDF, quando houver, só como metadado. Roda com o módulo desligado. */
    @Transactional(readOnly = true)
    public List<ContratoExportado> exportar(UUID alunoId) {
        return contratos.findByAlunoIdOrderByGeradoEmDescIdDesc(alunoId).stream()
                .map(c -> new ContratoExportado(c.getId(), c.getTitulo(), c.getOrigem(), c.getSignatario(), c.getSituacao(),
                        c.getPrazoAte(), c.getGeradoEm(), c.getCanceladoEm(), c.getMotivoCancelamento(), c.getTexto(), c.getSha256(),
                        assinatura(c)))
                .toList();
    }

    /**
     * Anonimização e "Excluir minha conta" (D16): o pendente e o cancelado saem; o assinado fica (texto, PDF e evidências), pela base de
     * exercício regular de direitos, com prazo de guarda a definir pelo jurídico. Quem chama já travou o aluno.
     */
    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID alunoId) {
        contratos.apagarNaoAssinados(alunoId, Situacao.ASSINADO);
    }

    // ---- montagem das respostas ----

    ContratoDetalhe detalhe(ContratoAluno c) {
        return detalhe(c, linkDe(c));
    }

    /** {@code link} já pronto: o gerar passa o que tem o código; as leituras passam o link sem código. */
    private ContratoDetalhe detalhe(ContratoAluno c, LinkDoContrato link) {
        String geradoPor = c.getGeradoPor() == null ? null : usuarios.findById(c.getGeradoPor()).map(Usuario::getNome).orElse(null);
        return new ContratoDetalhe(c.getId(), c.getAlunoId(), c.getGrupoId(), c.getTitulo(), c.getOrigem(), c.getSignatario(),
                c.getSituacao(), c.getPrazoAte(), c.vencido(Instant.now()), c.getContratacaoId(), c.getGeradoEm(), c.getCanceladoEm(),
                c.getMotivoCancelamento(), c.getTexto(), c.getSha256(), geradoPor, assinatura(c), link, c.getVersao());
    }

    /**
     * O link do responsável, sem código (ele só vem na resposta que o criou): o do próprio contrato do responsável pendente ou, no
     * contrato do aluno de um par, o do irmão. Nulo se não há link a mostrar.
     */
    private LinkDoContrato linkDe(ContratoAluno c) {
        ContratoAluno dono = c;
        if (c.getSignatario() == Signatario.ALUNO && c.getGrupoId() != null) {
            dono = contratos.findByGrupoId(c.getGrupoId()).stream().filter(x -> x.getSignatario() == Signatario.RESPONSAVEL)
                    .findFirst().orElse(null);
        }
        return dono != null && dono.getSituacao() == Situacao.PENDENTE && dono.temLink()
                ? new LinkDoContrato(dono.getId(), null, dono.getLinkExpiraEm()) : null;
    }

    private static ContratoResumo resumo(ContratoAluno c, Instant agora) {
        return new ContratoResumo(c.getId(), c.getAlunoId(), c.getGrupoId(), c.getTitulo(), c.getOrigem(), c.getSignatario(),
                c.getSituacao(), c.getPrazoAte(), c.vencido(agora), c.getContratacaoId(), c.getGeradoEm(), c.getAssinadoEm(),
                c.getCanceladoEm(), c.getSituacao() == Situacao.PENDENTE && c.temLink() ? c.getLinkExpiraEm() : null, c.getVersao());
    }

    private static Assinatura assinatura(ContratoAluno c) {
        // Assinado e já apagado pela guarda (D16): as evidências saíram, não há o que mostrar.
        return c.getSituacao() == Situacao.ASSINADO && c.getApagadoEm() == null
                ? new Assinatura(c.getAssinadoEm(), c.getAssinanteNome(), c.getAssinanteCpf(), c.getAssinanteIp(), c.getAssinanteAgente(),
                        c.getAssinanteDeclarouResponsavel())
                : null;
    }

    // ---- apoio ----

    /** O fim do dia de Brasília (23:59:59), o que {@code prazo_ate} guarda (D6). */
    static Instant fimDoDia(LocalDate dia) {
        return dia.atTime(23, 59, 59).atZone(Fuso.BRASILIA).toInstant();
    }

    private static Instant prazoAte(Integer dias) {
        return dias == null ? null : fimDoDia(LocalDate.now(Fuso.BRASILIA).plusDays(dias));
    }

    private ContratoAluno salvar(ContratoAluno c) {
        try {
            return contratos.saveAndFlush(c);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw conflitoDeEdicao();
        }
    }

    private static void exigirVersao(ContratoAluno c, Long versao) {
        if (versao == null || !versao.equals(c.getVersao())) {
            throw conflitoDeEdicao();
        }
    }

    private static boolean violou(DataIntegrityViolationException e, String restricao) {
        for (Throwable t = e; t != null; t = t.getCause()) {
            if (t instanceof org.hibernate.exception.ConstraintViolationException c && restricao.equals(c.getConstraintName())) {
                return true;
            }
        }
        return false;
    }

    private static ValidacaoException invalido(String campo, String mensagem) {
        return new ValidacaoException("Confira os dados do contrato.", "CONTRATO_INVALIDO", List.of(new ApiError.FieldError(campo, mensagem)));
    }

    private static NaoEncontradoException alunoNaoEncontrado() {
        return new NaoEncontradoException("Aluno não encontrado.");
    }

    private static NaoEncontradoException contratoNaoEncontrado() {
        return new NaoEncontradoException("Contrato não encontrado.");
    }

    private static ConflictException conflitoDeEdicao() {
        return new ConflictException("Outra pessoa ou aba alterou este contrato. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
    }
}
