package br.com.treinos.api.contratos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.contratos.ContratoAluno.Signatario;
import br.com.treinos.api.contratos.ContratoAluno.Situacao;
import br.com.treinos.api.contratos.ContratoDtos.AssinarRequest;
import br.com.treinos.api.contratos.ContratoDtos.AssinaturaDoAluno;
import br.com.treinos.api.contratos.ContratoDtos.ContratoDoAlunoDetalhe;
import br.com.treinos.api.contratos.ContratoDtos.ContratoDoAlunoResumo;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Contrato digital, lado do aluno (D1, D2): ele só vê os contratos dele (de outro aluno ou consultoria = 404) e o cancelado nunca
 * aparece. A assinatura é o aceite com evidências: o hash do texto que ele viu, o nome completo digitado e o "li e concordo", mais
 * conta, data e hora, IP e aparelho. Nome, IP e aparelho nunca vão a log, auditoria nem mensagem de erro. Sem nome de quem gerou nem
 * dado interno da equipe.
 */
@Service
public class ContratoDoAlunoService {

    static final int NOME_MAXIMO = 200;
    static final int IP_MAXIMO = 45;
    static final int AGENTE_MAXIMO = 300;

    private final ContratoAlunoRepository contratos;
    private final AlunoRepository alunos;
    private final Auditoria auditoria;

    public ContratoDoAlunoService(ContratoAlunoRepository contratos, AlunoRepository alunos, Auditoria auditoria) {
        this.contratos = contratos;
        this.alunos = alunos;
        this.auditoria = auditoria;
    }

    /** Os pendentes e os assinados, do mais novo ao mais antigo. */
    @Transactional(readOnly = true)
    public List<ContratoDoAlunoResumo> listar(UUID alunoId) {
        Instant agora = Instant.now();
        return contratos.findByAlunoIdOrderByGeradoEmDescIdDesc(alunoId).stream()
                .filter(c -> c.getSituacao() != Situacao.CANCELADO)
                .map(c -> new ContratoDoAlunoResumo(c.getId(), c.getTitulo(), c.getOrigem(), c.getSignatario(), c.getSituacao(),
                        c.getPrazoAte(), c.vencido(agora), c.getGeradoEm(), c.getAssinadoEm()))
                .toList();
    }

    @Transactional(readOnly = true)
    public ContratoDoAlunoDetalhe obter(UUID alunoId, UUID id) {
        return detalhe(contratos.findByIdAndAlunoId(id, alunoId).filter(c -> c.getSituacao() != Situacao.CANCELADO)
                .orElseThrow(ContratoDoAlunoService::naoEncontrado));
    }

    /**
     * Ordem das respostas: contrato que não é do aluno ou cancelado 404 (para ele o cancelado não existe); já assinado 200 sem
     * regravar; de assinatura do responsável 409 {@code CONTRATO_SIGNATARIO}; hash diferente do texto que ele viu
     * 409 {@code CONTRATO_ALTERADO}; "li e concordo" ausente ou nome que não confere com o cadastro (sem acento, sem diferença de
     * caixa e com espaços normalizados) 422 {@code ASSINATURA_INVALIDA}. A linha do contrato fica travada: duas assinaturas ao mesmo
     * tempo gravam uma só.
     */
    @Transactional
    public ContratoDoAlunoDetalhe assinar(UsuarioAutenticado eu, UUID id, AssinarRequest r, String ip, String agente) {
        ContratoAluno c = contratos.buscarDoAlunoParaAlterar(id, eu.alunoId()).orElseThrow(ContratoDoAlunoService::naoEncontrado);
        if (c.getSituacao() == Situacao.ASSINADO) {
            return detalhe(c);
        }
        if (c.getSituacao() == Situacao.CANCELADO) {
            throw naoEncontrado();
        }
        if (c.getSignatario() != Signatario.ALUNO) {
            throw new ConflictException("Este contrato é assinado pelo responsável.", "CONTRATO_SIGNATARIO");
        }
        if (r.sha256() == null || !c.getSha256().equals(r.sha256().strip().toLowerCase(Locale.ROOT))) {
            throw new ConflictException("O contrato mudou desde que você o abriu. Leia de novo antes de assinar.", "CONTRATO_ALTERADO");
        }
        Aluno aluno = alunos.findById(eu.alunoId()).orElseThrow(ContratoDoAlunoService::naoEncontrado);
        List<ApiError.FieldError> problemas = new ArrayList<>();
        if (!Boolean.TRUE.equals(r.aceite())) {
            problemas.add(new ApiError.FieldError("aceite", "Marque que leu e concorda com o contrato."));
        }
        String nome = r.nome() == null ? "" : Normalizer.normalize(r.nome().strip().replaceAll("\\s+", " "), Normalizer.Form.NFC);
        if (nome.isEmpty() || nome.length() > NOME_MAXIMO || !Buscas.semAcento(nome).equals(Buscas.semAcento(aluno.getNome()))) {
            problemas.add(new ApiError.FieldError("nome", "Digite o nome completo, como está no seu cadastro."));
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira os dados da assinatura.", "ASSINATURA_INVALIDA", problemas);
        }
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        c.assinarComoAluno(eu.usuarioId(), nome, limpar(ip, IP_MAXIMO), limpar(agente, AGENTE_MAXIMO), agora);
        try {
            c = contratos.saveAndFlush(c);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw new ConflictException("Outra pessoa ou aba alterou este contrato. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
        }
        auditoria.registrarEvento("CONTRATO_ASSINADO", "CONTRATO", c.getId(), "Assinou um contrato.");
        return detalhe(c);
    }

    private static ContratoDoAlunoDetalhe detalhe(ContratoAluno c) {
        AssinaturaDoAluno assinatura = c.getSituacao() == Situacao.ASSINADO
                ? new AssinaturaDoAluno(c.getAssinadoEm(), c.getAssinanteNome()) : null;
        return new ContratoDoAlunoDetalhe(c.getId(), c.getTitulo(), c.getOrigem(), c.getSignatario(), c.getSituacao(), c.getPrazoAte(),
                c.vencido(Instant.now()), c.getGeradoEm(), c.getTexto(), c.getSha256(), assinatura);
    }

    /** Sem caracteres de controle e no tamanho da coluna; ausente vira vazio (a evidência exige a coluna preenchida). */
    private static String limpar(String texto, int maximo) {
        if (texto == null) {
            return "";
        }
        String limpo = texto.replaceAll("\\p{Cntrl}", "").strip();
        return limpo.length() > maximo ? limpo.substring(0, maximo) : limpo;
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Contrato não encontrado.");
    }
}
