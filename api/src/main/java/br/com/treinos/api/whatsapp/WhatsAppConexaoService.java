package br.com.treinos.api.whatsapp;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ValidacaoException;
import br.com.treinos.api.whatsapp.MetaCliente.ModeloDaMeta;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ConexaoRequest;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ConexaoResponse;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ModeloRequest;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ModeloResponse;
import br.com.treinos.api.whatsapp.WhatsAppDtos.ModelosResponse;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * A conexão da consultoria com a Cloud API da Meta (número, conta e token de acesso cifrado) e o modelo (template) de cada tipo
 * de aviso. O token só entra: nenhuma resposta, auditoria, log ou mensagem de erro o repete, e a auditoria tem resumo fixo. Quem
 * chama já passou por {@code WHATSAPP_ALTERAR} e por {@link ExigeWhatsApp}. A consulta à Meta (situação dos modelos) é feita
 * fora de transação.
 */
@Service
public class WhatsAppConexaoService {

    private static final Pattern IDENTIFICADOR = Pattern.compile("^[0-9]{5,40}$");
    private static final Pattern TOKEN = Pattern.compile("^[^\\s\\p{Cntrl}]{20,1024}$");
    /** Nome de modelo da Meta: minúsculas, números e sublinhado. */
    private static final Pattern NOME_DO_MODELO = Pattern.compile("^[a-z0-9_]{1,512}$");
    /** Código de idioma da Meta: {@code pt_BR}, {@code en_US}, {@code pt}. */
    private static final Pattern IDIOMA = Pattern.compile("^[a-z]{2,3}(_[A-Z]{2})?$");

    static final String NAO_ENCONTRADO = "NAO_ENCONTRADO";
    static final String INDISPONIVEL = "INDISPONIVEL";

    private final WhatsAppConexaoRepository conexoes;
    private final WhatsAppModeloRepository modelos;
    private final WhatsAppRepositorio fila;
    private final CifraDoWhatsApp cifra;
    private final MetaCliente meta;
    private final WhatsAppProperties propriedades;
    private final Auditoria auditoria;

    public WhatsAppConexaoService(WhatsAppConexaoRepository conexoes, WhatsAppModeloRepository modelos, WhatsAppRepositorio fila,
                                  CifraDoWhatsApp cifra, MetaCliente meta, WhatsAppProperties propriedades, Auditoria auditoria) {
        this.conexoes = conexoes;
        this.modelos = modelos;
        this.fila = fila;
        this.cifra = cifra;
        this.meta = meta;
        this.propriedades = propriedades;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public ConexaoResponse obter() {
        return resposta(conexoes.findFirstBy());
    }

    /**
     * Cria ou altera. Sem conexão, {@code versao} preenchida é 409 (alguém a removeu) e o token é obrigatório; com conexão, a
     * versão é obrigatória e conferida e o token em branco mantém o gravado (e a data dele). A auditoria sai sempre que grava.
     */
    @Transactional
    public ConexaoResponse salvar(ConexaoRequest r) {
        String numero = identificador(r.phoneNumberId(), "phoneNumberId", "o número (Phone Number ID)");
        String conta = identificador(r.wabaId(), "wabaId", "a conta (WhatsApp Business Account ID)");
        String token = token(r.accessToken());
        UUID consultoria = consultoriaAtual();
        // Microssegundos, como o banco grava: a resposta da criação e as leituras seguintes mostram a mesma data.
        Instant agora = Instant.now().truncatedTo(java.time.temporal.ChronoUnit.MICROS);
        Optional<WhatsAppConexao> existente = conexoes.findFirstBy();
        WhatsAppConexao gravada;
        try {
            if (existente.isEmpty()) {
                if (r.versao() != null) {
                    throw conflito();
                }
                if (token == null) {
                    throw invalido("accessToken", "Informe o token de acesso.");
                }
                gravada = conexoes.saveAndFlush(new WhatsAppConexao(numero, conta, cifra.cifrar(consultoria, token), agora));
            } else {
                WhatsAppConexao c = existente.get();
                if (r.versao() == null || !r.versao().equals(c.getVersao())) {
                    throw conflito();
                }
                c.alterar(numero, conta, token == null ? null : cifra.cifrar(consultoria, token), agora);
                gravada = conexoes.saveAndFlush(c);
            }
        } catch (DataIntegrityViolationException e) {
            if (violou(e, "ux_whatsapp_conexao_consultoria")) {
                throw conflito();
            }
            throw e;
        }
        auditoria.registrarEvento("WHATSAPP_CONEXAO_CONFIGURADA", "WHATSAPP_CONEXAO", gravada.getId(),
                "Configurou a conexão do WhatsApp.");
        return resposta(Optional.of(gravada));
    }

    /**
     * Sem conexão não há o que remover (204 do mesmo jeito, sem auditoria); versão dada e velha é 409. Os avisos que ainda não
     * saíram são cancelados ({@code CONEXAO_REMOVIDA}); os modelos ficam (são só nomes).
     */
    @Transactional
    public void remover(Long versao) {
        conexoes.findFirstBy().ifPresent(c -> {
            if (versao != null && !versao.equals(c.getVersao())) {
                throw conflito();
            }
            conexoes.delete(c);
            conexoes.flush();
            fila.cancelarPendentesDaConsultoria(consultoriaAtual(), "CONEXAO_REMOVIDA");
            auditoria.registrarEvento("WHATSAPP_CONEXAO_REMOVIDA", "WHATSAPP_CONEXAO", c.getId(), "Removeu a conexão do WhatsApp.");
        });
    }

    /**
     * Os seis tipos, cada um com o modelo configurado (ou não), o texto sugerido e a situação que a Meta dá ao modelo agora. Uma
     * única consulta à Meta, fora de transação; se ela não responder (sem conexão, token recusado, fora do ar), os configurados
     * saem como {@value #INDISPONIVEL} e a lista continua valendo.
     */
    public ModelosResponse listarModelos() {
        Map<TipoDeAviso, WhatsAppModelo> gravados = modelos.findAll().stream()
                .collect(Collectors.toMap(WhatsAppModelo::getTipo, Function.identity()));
        Optional<List<ModeloDaMeta>> daMeta = gravados.isEmpty() ? Optional.empty() : situacoesNaMeta();
        List<ModeloResponse> itens = new ArrayList<>();
        for (TipoDeAviso tipo : TipoDeAviso.values()) {
            WhatsAppModelo m = gravados.get(tipo);
            if (m == null) {
                itens.add(new ModeloResponse(tipo, false, null, null, null, null, ModelosDeTexto.sugerido(tipo),
                        ModelosDeTexto.variaveis(tipo)));
                continue;
            }
            String situacao = daMeta.map(lista -> lista.stream()
                    .filter(x -> x.nome().equals(m.getNome()) && x.idioma().equals(m.getIdioma())).findFirst()
                    .map(ModeloDaMeta::situacao).orElse(NAO_ENCONTRADO)).orElse(INDISPONIVEL);
            itens.add(new ModeloResponse(tipo, true, m.getNome(), m.getIdioma(), situacao, m.getVersao(),
                    ModelosDeTexto.sugerido(tipo), ModelosDeTexto.variaveis(tipo)));
        }
        return new ModelosResponse(itens);
    }

    /**
     * Cria ou altera o modelo do tipo, com a mesma regra de versão da conexão. Igual ao que está gravado = 200 sem auditoria. A
     * resposta não consulta a Meta ({@code situacao} nulo): a tela recarrega a lista.
     */
    @Transactional
    public ModeloResponse salvarModelo(TipoDeAviso tipo, ModeloRequest r) {
        String nome = r.nome() == null ? "" : r.nome().trim();
        String idioma = r.idioma() == null ? "" : r.idioma().trim();
        List<ApiError.FieldError> problemas = new ArrayList<>();
        if (!NOME_DO_MODELO.matcher(nome).matches()) {
            problemas.add(new ApiError.FieldError("nome", "Use o nome do modelo como está na Meta: minúsculas, números e sublinhado."));
        }
        if (!IDIOMA.matcher(idioma).matches()) {
            problemas.add(new ApiError.FieldError("idioma", "Use o código do idioma do modelo, como pt_BR."));
        }
        if (!problemas.isEmpty()) {
            throw new ValidacaoException("Confira o modelo do WhatsApp.", "WHATSAPP_INVALIDO", problemas);
        }
        Instant agora = Instant.now();
        Optional<WhatsAppModelo> existente = modelos.findByTipo(tipo);
        WhatsAppModelo gravado;
        boolean mudou;
        try {
            if (existente.isEmpty()) {
                if (r.versao() != null) {
                    throw conflito();
                }
                gravado = modelos.saveAndFlush(new WhatsAppModelo(tipo, nome, idioma, agora));
                mudou = true;
            } else {
                gravado = existente.get();
                if (r.versao() == null || !r.versao().equals(gravado.getVersao())) {
                    throw conflito();
                }
                mudou = gravado.alterar(nome, idioma, agora);
                gravado = modelos.saveAndFlush(gravado);
            }
        } catch (DataIntegrityViolationException e) {
            if (violou(e, "ux_whatsapp_modelo_tipo")) {
                throw conflito();
            }
            throw e;
        }
        if (mudou) {
            auditoria.registrarEvento("WHATSAPP_MODELO_CONFIGURADO", "WHATSAPP_MODELO", gravado.getId(),
                    "Configurou um modelo de mensagem do WhatsApp.");
        }
        return new ModeloResponse(tipo, true, gravado.getNome(), gravado.getIdioma(), null, gravado.getVersao(),
                ModelosDeTexto.sugerido(tipo), ModelosDeTexto.variaveis(tipo));
    }

    /** Sem modelo do tipo não há o que remover (204 do mesmo jeito); versão dada e velha é 409. O tipo deixa de ser enviado. */
    @Transactional
    public void removerModelo(TipoDeAviso tipo, Long versao) {
        modelos.findByTipo(tipo).ifPresent(m -> {
            if (versao != null && !versao.equals(m.getVersao())) {
                throw conflito();
            }
            modelos.delete(m);
            modelos.flush();
            auditoria.registrarEvento("WHATSAPP_MODELO_REMOVIDO", "WHATSAPP_MODELO", m.getId(),
                    "Removeu um modelo de mensagem do WhatsApp.");
        });
    }

    /** Os modelos da conta na Meta, ou vazio se não deu para perguntar (nunca lança: é só informação para a tela). */
    private Optional<List<ModeloDaMeta>> situacoesNaMeta() {
        try {
            Optional<WhatsAppConexao> conexao = conexoes.findFirstBy();
            if (conexao.isEmpty()) {
                return Optional.empty();
            }
            String token = cifra.decifrar(consultoriaAtual(), conexao.get().getTokenCifrado());
            return Optional.of(meta.listarModelos(token, conexao.get().getWabaId()));
        } catch (MetaCliente.FalhaNaMeta | CifraDoWhatsAppIndisponivelException e) {
            return Optional.empty();
        }
    }

    private ConexaoResponse resposta(Optional<WhatsAppConexao> conexao) {
        return new ConexaoResponse(propriedades.habilitado(), conexao.isPresent(),
                conexao.map(WhatsAppConexao::getPhoneNumberId).orElse(null), conexao.map(WhatsAppConexao::getWabaId).orElse(null),
                conexao.map(WhatsAppConexao::getTokenGravadoEm).orElse(null), conexao.map(WhatsAppConexao::getVersao).orElse(null));
    }

    private static String identificador(String texto, String campo, String descricao) {
        String valor = texto == null ? "" : texto.trim();
        if (!IDENTIFICADOR.matcher(valor).matches()) {
            throw invalido(campo, "Informe " + descricao + ": só números, de 5 a 40 dígitos.");
        }
        return valor;
    }

    /** Em branco = não mandou. A mensagem de erro nunca repete o valor. */
    private static String token(String texto) {
        String token = texto == null ? "" : texto.trim();
        if (token.isEmpty()) {
            return null;
        }
        if (!TOKEN.matcher(token).matches()) {
            throw invalido("accessToken", "O token de acesso precisa ter de 20 a 1024 caracteres, sem espaços.");
        }
        return token;
    }

    private static boolean violou(DataIntegrityViolationException e, String restricao) {
        Throwable causa = e.getMostSpecificCause();
        return causa.getMessage() != null && causa.getMessage().contains(restricao);
    }

    private static UUID consultoriaAtual() {
        UUID consultoria = TenantContext.get();
        if (consultoria == null) {
            throw new IllegalStateException("Sem consultoria na requisição.");
        }
        return consultoria;
    }

    private static ConflictException conflito() {
        return new ConflictException("Outra pessoa ou aba alterou o WhatsApp. Recarregue para ver a versão atual.", "CONFLITO_EDICAO");
    }

    private static ValidacaoException invalido(String campo, String mensagem) {
        return new ValidacaoException("Confira os dados do WhatsApp.", "WHATSAPP_INVALIDO",
                List.of(new ApiError.FieldError(campo, mensagem)));
    }
}
