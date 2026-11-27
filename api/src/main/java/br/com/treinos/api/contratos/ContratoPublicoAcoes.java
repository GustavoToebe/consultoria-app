package br.com.treinos.api.contratos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.contratos.ContratoAluno.Origem;
import br.com.treinos.api.contratos.ContratoDtos.AssinarContratoPublicoRequest;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoAberto;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoAssinado;
import br.com.treinos.api.contratos.ContratoDtos.ContratoPublicoConsulta;
import br.com.treinos.api.pagamentos.PagamentosDoAluno;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.text.Normalizer;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * As ações da página pública do contrato do responsável (D11, D28, S3 a S5), cada uma numa transação curta e já dentro da consultoria
 * do link ({@link ContratoPublicoService} abre o {@code TenantContext} e conta os erros de CPF fora da transação). O link sozinho só
 * mostra a marca e o título; texto, PDF e assinatura exigem o CPF do responsável, conferido com o do cadastro. Link inexistente,
 * vencido, usado ou de contrato cancelado é sempre o mesmo 404. Nada de CPF, nome, IP, texto ou código em log, auditoria nem erro.
 */
@Service
public class ContratoPublicoAcoes {

    private static final int NOME_MAXIMO = 200;

    private final ContratoAlunoRepository contratos;
    private final ContratoArquivoRepository arquivos;
    private final PagamentosDoAluno pagamentos;
    private final MarcaService marcas;
    private final Auditoria auditoria;

    public ContratoPublicoAcoes(ContratoAlunoRepository contratos, ContratoArquivoRepository arquivos, PagamentosDoAluno pagamentos,
                                MarcaService marcas, Auditoria auditoria) {
        this.contratos = contratos;
        this.arquivos = arquivos;
        this.pagamentos = pagamentos;
        this.marcas = marcas;
        this.auditoria = auditoria;
    }

    /** O CPF digitado não é o do responsável cadastrado: 422 {@code CPF_NAO_CONFERE}; quem chama conta a tentativa. */
    static final class CpfNaoConfere extends ValidacaoException {
        private static final long serialVersionUID = 1L;

        CpfNaoConfere() {
            super("Confira os dados.", "CPF_NAO_CONFERE", List.of(new ApiError.FieldError("cpf", "O CPF não confere.")));
        }
    }

    /** Só a marca da consultoria e o título (S3): nada do aluno nem do texto antes do CPF. */
    @Transactional(readOnly = true)
    public ContratoPublicoConsulta consultar(String hash) {
        ContratoAluno c = vigente(contratos.findByLinkHash(hash));
        return new ContratoPublicoConsulta(marcas.marca(TenantContext.get()), c.getTitulo());
    }

    /** O contrato inteiro, só com o CPF conferido: texto no modelo, {@code temArquivo} no PDF. */
    @Transactional(readOnly = true)
    public ContratoPublicoAberto abrir(String hash, String cpf) {
        ContratoAluno c = vigente(contratos.findByLinkHash(hash));
        conferirCpf(c, cpf);
        return new ContratoPublicoAberto(c.getTitulo(), c.getOrigem(), c.getTexto(), c.getOrigem() == Origem.PDF, c.getSha256());
    }

    /** Os bytes do PDF do próprio contrato, só com o CPF conferido. Contrato de modelo = o mesmo 404. */
    @Transactional(readOnly = true)
    public byte[] arquivo(String hash, String cpf) {
        ContratoAluno c = vigente(contratos.findByLinkHash(hash));
        conferirCpf(c, cpf);
        if (c.getOrigem() != Origem.PDF) {
            throw linkInvalido();
        }
        return arquivos.findById(c.getId()).map(ContratoArquivo::getBytes).orElseThrow(ContratoPublicoAcoes::linkInvalido);
    }

    /**
     * Ordem das respostas: link que não vale 404; CPF que não confere 422 {@code CPF_NAO_CONFERE}; hash diferente do contrato que foi
     * mostrado 409 {@code CONTRATO_ALTERADO}; aceite, declaração de responsável legal ou nome com menos de duas palavras 422
     * {@code ASSINATURA_INVALIDA}. A linha fica travada: duas assinaturas ao mesmo tempo gravam uma só, e a segunda, que esperava a
     * trava, não acha mais o link (o mesmo 404). A assinatura grava o CPF do cadastro formatado e a declaração (D28).
     */
    @Transactional
    public ContratoPublicoAssinado assinar(String hash, AssinarContratoPublicoRequest r, String ip, String agente) {
        ContratoAluno c = vigente(contratos.buscarPorLinkParaAlterar(hash));
        String cpfDoCadastro = conferirCpf(c, r.cpf());
        if (r.sha256() == null || !c.getSha256().equals(r.sha256().strip().toLowerCase(Locale.ROOT))) {
            throw new ConflictException("O contrato mudou desde que você o abriu. Leia de novo antes de assinar.", "CONTRATO_ALTERADO");
        }
        List<ApiError.FieldError> problemas = new ArrayList<>();
        if (!Boolean.TRUE.equals(r.aceite())) {
            problemas.add(new ApiError.FieldError("aceite", "Marque que leu e concorda com o contrato."));
        }
        if (!Boolean.TRUE.equals(r.declaroResponsavelLegal())) {
            problemas.add(new ApiError.FieldError("declaroResponsavelLegal", "Declare que você é o responsável legal."));
        }
        String nome = r.nome() == null ? "" : Normalizer.normalize(r.nome().strip().replaceAll("\\s+", " "), Normalizer.Form.NFC);
        if (nome.isEmpty() || nome.length() > NOME_MAXIMO || nome.indexOf(' ') < 0) {
            problemas.add(new ApiError.FieldError("nome", "Digite o seu nome completo."));
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira os dados da assinatura.", "ASSINATURA_INVALIDA", problemas);
        }
        Instant agora = Instant.now().truncatedTo(ChronoUnit.MICROS);
        c.assinarComoResponsavel(nome, cpfDoCadastro, ContratoDoAlunoService.limpar(ip, ContratoDoAlunoService.IP_MAXIMO),
                ContratoDoAlunoService.limpar(agente, ContratoDoAlunoService.AGENTE_MAXIMO), agora);
        try {
            c = contratos.saveAndFlush(c);
        } catch (ObjectOptimisticLockingFailureException e) {
            throw linkInvalido();
        }
        auditoria.registrarDoSistema(TenantContext.get(), "CONTRATO_ASSINADO", "CONTRATO", c.getId(),
                "Assinou um contrato pelo link do responsável.");
        return new ContratoPublicoAssinado(c.getTitulo(), c.getTexto(), c.getSha256(), c.getAssinadoEm(), c.getAssinanteNome());
    }

    // ---- apoio ----

    /** O contrato do link só vale pendente e com o link vigente; qualquer outro caso é o mesmo 404. */
    private static ContratoAluno vigente(Optional<ContratoAluno> contrato) {
        Instant agora = Instant.now();
        return contrato.filter(c -> c.linkValido(agora)).orElseThrow(ContratoPublicoAcoes::linkInvalido);
    }

    /**
     * Confere o CPF digitado com o do responsável no cadastro (só dígitos, comparação em tempo constante) e devolve o do cadastro,
     * formatado, que é o que a assinatura grava. Sem responsável ou sem CPF cadastrado (ou com o financeiro desligado, onde ele mora)
     * não há como conferir, e vale como CPF que não confere.
     */
    private String conferirCpf(ContratoAluno c, String informado) {
        String cadastrado = pagamentos.responsavelParaContrato(c.getAlunoId())
                .map(PagamentosDoAluno.ResponsavelParaContrato::cpf).orElse(null);
        String esperado = digitos(cadastrado);
        boolean confere = MessageDigest.isEqual(esperado.getBytes(StandardCharsets.US_ASCII),
                digitos(informado).getBytes(StandardCharsets.US_ASCII));
        if (!confere || esperado.isEmpty()) {
            throw new CpfNaoConfere();
        }
        return esperado.length() == 11
                ? esperado.substring(0, 3) + "." + esperado.substring(3, 6) + "." + esperado.substring(6, 9) + "-" + esperado.substring(9)
                : cadastrado.strip();
    }

    private static String digitos(String texto) {
        return texto == null ? "" : texto.replaceAll("\\D", "");
    }

    /** O 404 único da página pública: o mesmo para link inexistente, vencido, usado ou de contrato cancelado. */
    static NaoEncontradoException linkInvalido() {
        return new NaoEncontradoException("Link de contrato inválido ou vencido.");
    }
}
