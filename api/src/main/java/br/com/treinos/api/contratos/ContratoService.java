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
import br.com.treinos.api.contratos.ContratoDtos.GerarContratoRequest;
import br.com.treinos.api.contratos.ContratoDtos.PreviaDoContrato;
import br.com.treinos.api.contratos.ContratoDtos.ProrrogarRequest;
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

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

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

    private final ContratoAlunoRepository contratos;
    private final ContratoModeloService modelos;
    private final PreenchimentoDoContrato preenchimento;
    private final AlunoRepository alunos;
    private final ConsultoriaRepository consultorias;
    private final UsuarioRepository usuarios;
    private final Auditoria auditoria;

    public ContratoService(ContratoAlunoRepository contratos, ContratoModeloService modelos, PreenchimentoDoContrato preenchimento,
                           AlunoRepository alunos, ConsultoriaRepository consultorias, UsuarioRepository usuarios,
                           Auditoria auditoria) {
        this.contratos = contratos;
        this.modelos = modelos;
        this.preenchimento = preenchimento;
        this.alunos = alunos;
        this.consultorias = consultorias;
        this.usuarios = usuarios;
        this.auditoria = auditoria;
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
        Preenchido p = preencher(aluno, r);
        return new PreviaDoContrato(p.titulo(), p.texto(), p.resultado().faltas(), p.resultado().faltas().isEmpty());
    }

    @Transactional
    public Gerado gerar(UsuarioAutenticado eu, UUID alunoId, GerarContratoRequest r) {
        if (r.pedidoId() == null) {
            throw invalido("pedidoId", "Informe o identificador do pedido.");
        }
        // A trava do aluno vem antes da consulta do pedido: de duas chamadas iguais ao mesmo tempo, a segunda espera e recebe o que a
        // primeira gerou (a mesma ordem da cobrança avulsa). A consultoria trava antes do aluno, na ordem do resto do código
        // (consultoria → aluno), para não dar deadlock com "Excluir minha conta".
        consultorias.travar(TenantContext.get());
        Aluno aluno = alunos.buscarParaAlterar(alunoId).orElseThrow(ContratoService::alunoNaoEncontrado);
        var existente = contratos.findByPedidoId(r.pedidoId());
        if (existente.isPresent()) {
            if (!existente.get().getAlunoId().equals(alunoId)) {
                throw new ConflictException("Este pedido já foi usado em outro contrato.", "PEDIDO_JA_USADO");
            }
            return new Gerado(detalhe(existente.get()), false);
        }
        AlunoService.exigirNaoAnonimizado(aluno);
        if (!aluno.isAtivo()) {
            throw new ConflictException("Aluno inativo. Reative para gerar um contrato.", "ALUNO_INATIVO");
        }
        Signatario signatario = signatario(r);
        Preenchido p = preencher(aluno, r);
        if (!p.resultado().faltas().isEmpty()) {
            throw new ValidacaoException("Faltam dados para preencher o contrato.", "CONTRATO_INCOMPLETO",
                    p.resultado().faltas().stream().map(f -> new ApiError.FieldError(f.campo(), f.mensagem())).toList());
        }
        String texto = TextoDoContrato.normalizar(p.texto());
        if (texto.length() > TEXTO_PREENCHIDO_MAXIMO) {
            throw invalido("texto", "O contrato preenchido passa de 100.000 caracteres. Encurte o modelo.");
        }
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        ContratoAluno novo = new ContratoAluno(alunoId, r.contratacaoId(), Origem.MODELO, p.modeloId(), p.titulo(), texto,
                TextoDoContrato.sha256(texto), signatario, prazoAte(p.prazoDias()), eu.usuarioId(), r.pedidoId(), agora);
        try {
            novo = contratos.saveAndFlush(novo);
        } catch (DataIntegrityViolationException e) {
            if (violou(e, "ux_contrato_pedido")) {
                throw new ConflictException("Este pedido já foi usado em outro contrato.", "PEDIDO_JA_USADO");
            }
            throw e;
        }
        auditoria.registrarEvento("CONTRATO_GERADO", "CONTRATO", novo.getId(), "Gerou um contrato para o aluno.");
        return new Gerado(detalhe(novo), true);
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

    /** Por ora só o aluno assina: o responsável por link é o passo 4 do plano. */
    private static Signatario signatario(GerarContratoRequest r) {
        if (r.signatario() == null || r.signatario().isBlank() || "ALUNO".equals(r.signatario())) {
            return Signatario.ALUNO;
        }
        // shortcut: só o aluno assina até o passo 4 (link do responsável)
        throw invalido("signatario", "Por enquanto só o aluno assina o contrato.");
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
        ContratoAluno c = contratos.buscarParaAlterar(id).orElseThrow(ContratoService::contratoNaoEncontrado);
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
        c.cancelar(motivo, Instant.now().truncatedTo(ChronoUnit.MICROS));
        c = salvar(c);
        auditoria.registrarEvento("CONTRATO_CANCELADO", "CONTRATO", id, "Cancelou um contrato pendente.");
        return detalhe(c);
    }

    /**
     * Estende o prazo do pendente em {@code dias} (1 a 60) a partir do que for mais tarde, o fim do prazo atual ou hoje. Contrato sem
     * prazo (a consultoria não trava) = 409 {@code CONTRATO_SEM_PRAZO}; assinado ou cancelado = 409 {@code CONTRATO_NAO_PENDENTE}.
     */
    @Transactional
    public ContratoDetalhe prorrogar(UUID id, ProrrogarRequest r) {
        ContratoAluno c = contratos.buscarParaAlterar(id).orElseThrow(ContratoService::contratoNaoEncontrado);
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
        c.prorrogar(fimDoDia(base.plusDays(r.dias())), agora);
        c = salvar(c);
        auditoria.registrarEvento("CONTRATO_PRAZO_PRORROGADO", "CONTRATO", id, "Prorrogou o prazo de um contrato.");
        return detalhe(c);
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
        String geradoPor = c.getGeradoPor() == null ? null : usuarios.findById(c.getGeradoPor()).map(Usuario::getNome).orElse(null);
        return new ContratoDetalhe(c.getId(), c.getAlunoId(), c.getTitulo(), c.getOrigem(), c.getSignatario(), c.getSituacao(),
                c.getPrazoAte(), c.vencido(Instant.now()), c.getContratacaoId(), c.getGeradoEm(), c.getCanceladoEm(),
                c.getMotivoCancelamento(), c.getTexto(), c.getSha256(), geradoPor, assinatura(c), c.getVersao());
    }

    private static ContratoResumo resumo(ContratoAluno c, Instant agora) {
        return new ContratoResumo(c.getId(), c.getAlunoId(), c.getTitulo(), c.getOrigem(), c.getSignatario(), c.getSituacao(),
                c.getPrazoAte(), c.vencido(agora), c.getContratacaoId(), c.getGeradoEm(), c.getAssinadoEm(), c.getCanceladoEm(),
                c.getVersao());
    }

    private static Assinatura assinatura(ContratoAluno c) {
        return c.getSituacao() == Situacao.ASSINADO
                ? new Assinatura(c.getAssinadoEm(), c.getAssinanteNome(), c.getAssinanteCpf(), c.getAssinanteIp(), c.getAssinanteAgente())
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
