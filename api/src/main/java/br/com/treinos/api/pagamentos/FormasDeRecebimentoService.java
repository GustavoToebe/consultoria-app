package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.FormasDeRecebimento.DadosDoPix;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.FormasDeRecebimentoRequest;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.FormasDeRecebimentoResponse;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.PixConfigRequest;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.PixConfigResponse;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * Como o treinador recebe: InfinitePay, link próprio do plano, Pix copia e cola e Manual (sempre ligado). Uma linha por
 * consultoria; sem linha vale o comportamento de antes (InfinitePay e Manual) e o GET não cria nada. O PUT segue o padrão dos
 * lembretes: criar com {@code versao} ou alterar sem ela, ou com versão velha, é 409 {@code CONFLITO_EDICAO}. A auditoria tem
 * resumo fixo (nunca a chave, o nome nem a cidade) e só sai quando algo muda.
 */
@Service
public class FormasDeRecebimentoService {

    private static final String CHAVE_DA_TABELA = "forma_de_recebimento_pkey";

    private final FormasDeRecebimentoRepository formas;
    private final Auditoria auditoria;

    public FormasDeRecebimentoService(FormasDeRecebimentoRepository formas, Auditoria auditoria) {
        this.formas = formas;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public FormasDeRecebimentoResponse obter() {
        return resposta(formas.daConsultoria());
    }

    /** O que a regra do aluno lê (a fase do aluno junta com a credencial da InfinitePay e o link do plano). */
    @Transactional(readOnly = true)
    public FormasDePagamentoDoAluno.Ligadas ligadas() {
        return formas.daConsultoria().map(FormasDeRecebimento::ligadas).orElse(FormasDePagamentoDoAluno.Ligadas.PADRAO);
    }

    @Transactional
    public FormasDeRecebimentoResponse salvar(FormasDeRecebimentoRequest r) {
        Optional<FormasDeRecebimento> existente = formas.daConsultoria();
        DadosDoPix pix = validar(r, existente.map(FormasDeRecebimento::dadosDoPix).orElse(null));
        Instant agora = Instant.now();
        FormasDeRecebimento gravada;
        boolean mudou;
        if (existente.isEmpty()) {
            if (r.versao() != null) {
                throw conflito();
            }
            gravada = new FormasDeRecebimento(TenantContext.get(), agora);
            gravada.alterar(r.infinitePay(), r.linkProprio(), r.pix(), pix, agora);
            mudou = true;
            try {
                gravada = formas.saveAndFlush(gravada);
            } catch (DataIntegrityViolationException e) {
                if (ContratacaoService.violou(e, CHAVE_DA_TABELA)) {
                    throw conflito();
                }
                throw e;
            }
        } else {
            gravada = existente.get();
            if (r.versao() == null || !r.versao().equals(gravada.getVersao())) {
                throw conflito();
            }
            mudou = gravada.alterar(r.infinitePay(), r.linkProprio(), r.pix(), pix, agora);
            gravada = formas.saveAndFlush(gravada);
        }
        if (mudou) {
            auditoria.registrarEvento("FORMAS_DE_RECEBIMENTO_CONFIGURADAS", "FORMAS_DE_RECEBIMENTO", gravada.getConsultoriaId(),
                    "Configurou as formas de recebimento.");
        }
        return resposta(Optional.of(gravada));
    }

    /**
     * D12: apaga chave, nome e cidade e desliga o Pix, com a {@code versao} conferida (sem linha ou versão velha = 409
     * {@code CONFLITO_EDICAO}). Já sem Pix nem dados não grava nem audita (idempotente). A auditoria tem resumo fixo: nunca a
     * chave, o nome nem a cidade.
     */
    @Transactional
    public FormasDeRecebimentoResponse apagarPix(Long versao) {
        FormasDeRecebimento f = formas.daConsultoria().orElseThrow(FormasDeRecebimentoService::conflito);
        if (versao == null || !versao.equals(f.getVersao())) {
            throw conflito();
        }
        if (f.apagarPix(Instant.now())) {
            f = formas.saveAndFlush(f);
            auditoria.registrarEvento("PIX_APAGADO", "FORMAS_DE_RECEBIMENTO", f.getConsultoriaId(), "Apagou os dados do Pix.");
        }
        return resposta(Optional.of(f));
    }

    /**
     * Confere o corpo e devolve os dados do Pix a gravar ({@code null} = manter os gravados). Mensagens fixas, sem repetir valor.
     */
    private static DadosDoPix validar(FormasDeRecebimentoRequest r, DadosDoPix gravado) {
        List<ApiError.FieldError> problemas = new ArrayList<>();
        if (!r.manual()) {
            problemas.add(new ApiError.FieldError("manual", "O recebimento manual fica sempre ligado."));
        }
        DadosDoPix pix = null;
        PixConfigRequest c = r.pixConfig();
        if (c == null) {
            if (r.pix()) {
                problemas.add(new ApiError.FieldError("pixConfig", "Informe os dados do Pix para ligá-lo."));
            }
        } else {
            pix = validarPix(c, gravado, problemas);
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira as formas de recebimento.", "FORMAS_INVALIDAS", problemas);
        }
        return pix;
    }

    private static DadosDoPix validarPix(PixConfigRequest c, DadosDoPix gravado, List<ApiError.FieldError> problemas) {
        ChavePix.Tipo tipo = tipo(c.tipoChave());
        if (tipo == null) {
            problemas.add(new ApiError.FieldError("pixConfig.tipoChave", "Escolha o tipo da chave Pix."));
        }
        String nome = c.nomeRecebedor() == null ? "" : c.nomeRecebedor().strip();
        if (BrCodePix.texto(nome, BrCodePix.NOME_MAXIMO + 1).isEmpty() || nome.length() > BrCodePix.NOME_MAXIMO) {
            problemas.add(new ApiError.FieldError("pixConfig.nomeRecebedor",
                    "Informe o nome do recebedor, com até " + BrCodePix.NOME_MAXIMO + " caracteres."));
        }
        String cidade = c.cidade() == null ? "" : c.cidade().strip();
        if (BrCodePix.texto(cidade, BrCodePix.CIDADE_MAXIMO + 1).isEmpty() || cidade.length() > BrCodePix.CIDADE_MAXIMO) {
            problemas.add(new ApiError.FieldError("pixConfig.cidade",
                    "Informe a cidade, com até " + BrCodePix.CIDADE_MAXIMO + " caracteres."));
        }
        String chave = null;
        if (tipo != null) {
            boolean mesmoTipo = gravado != null && gravado.tipo() == tipo;
            // Em branco, ou a própria máscara que a tela mostrou, mantém a gravada (só vale com o mesmo tipo).
            if (c.chave() == null || c.chave().isBlank()
                    || (mesmoTipo && c.chave().strip().equals(ChavePix.mascarar(tipo, gravado.chave())))) {
                chave = mesmoTipo ? gravado.chave() : null;
                if (chave == null) {
                    problemas.add(new ApiError.FieldError("pixConfig.chave", "Informe a chave Pix."));
                }
            } else {
                chave = ChavePix.normalizar(tipo, c.chave());
                if (chave == null) {
                    problemas.add(new ApiError.FieldError("pixConfig.chave", "Chave Pix inválida para o tipo escolhido."));
                }
            }
        }
        return problemas.isEmpty() ? new DadosDoPix(tipo, chave, nome, cidade) : null;
    }

    private static ChavePix.Tipo tipo(String texto) {
        if (texto == null) {
            return null;
        }
        try {
            return ChavePix.Tipo.valueOf(texto.strip());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    private static FormasDeRecebimentoResponse resposta(Optional<FormasDeRecebimento> gravada) {
        if (gravada.isEmpty()) {
            return new FormasDeRecebimentoResponse(true, false, false, true, null, null);
        }
        FormasDeRecebimento f = gravada.get();
        PixConfigResponse pix = !f.temChave() ? null
                : new PixConfigResponse(f.getPixTipoChave().name(), true, f.chaveMascarada(), f.getPixNomeRecebedor(),
                        f.getPixCidade());
        return new FormasDeRecebimentoResponse(f.isInfinitePay(), f.isLinkProprio(), f.isPix(), true, pix, f.getVersao());
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou as formas de recebimento. Recarregue para ver a versão atual.",
                "CONFLITO_EDICAO");
    }
}
