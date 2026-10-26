package br.com.treinos.api.fotos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.anamneses.Anamnese;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.consultoria.LogoRepositorio;
import br.com.treinos.api.equipe.AcessoAtual;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.execucao.RegistroPeso;
import br.com.treinos.api.execucao.RegistroPesoRepository;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageInputStream;
import javax.imageio.stream.MemoryCacheImageInputStream;
import javax.imageio.stream.MemoryCacheImageOutputStream;
import java.awt.Color;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.text.Normalizer;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

/**
 * Linha do tempo das fotos já enviadas e a imagem de comparação para divulgação.
 * A imagem nasce aqui e não fica gravada: o servidor já tem os bytes, a autorização é conferida num lugar só
 * e a web e o celular recebem o mesmo JPEG ou o mesmo ZIP, sem texto e sem EXIF.
 */
@Service
public class ComparacaoDeFotosService {

    public record Item(UUID fotoId, String origem, UUID origemId, LocalDate data, String perguntaId,
                       String posicao, int ordem, BigDecimal pesoKg) {
    }

    public record UsoDeImagem(Instant autorizadoEm) {
    }

    public record PedidoDeUso(boolean autorizado) {
    }

    public enum FormatoPedido {
        STORIES, FEED, AMBOS
    }

    /** JPEG único ou ZIP já nomeado. Nada disso fica gravado. Classe, e não record: o byte[] no record é recusado. */
    public static final class ArquivoComparacao {
        private final byte[] bytes;
        private final String nome;
        private final MediaType tipo;

        ArquivoComparacao(byte[] bytes, String nome, MediaType tipo) {
            this.bytes = bytes;
            this.nome = nome;
            this.tipo = tipo;
        }

        public byte[] bytes() {
            return bytes;
        }

        public String nome() {
            return nome;
        }

        public MediaType tipo() {
            return tipo;
        }
    }

    static {
        // O padrão do JDK grava um arquivo temporário em disco para cada fluxo lido: dado de aluno não vai para o disco.
        // Estado global da JVM (vale para todo ImageIO do processo); hoje só esta classe usa ImageIO no código de produção.
        ImageIO.setUseCache(false);
    }

    private static final String RESUMO_AUTORIZADO = "Autorizou o uso das fotos.";
    private static final String RESUMO_REVOGADO = "Revogou o uso das fotos.";
    static final String RESUMO_GERADA = "Gerou uma imagem de comparação de fotos.";

    private final AtualizacaoFotoRepository fotos;
    private final AlunoRepository alunos;
    private final RegistroPesoRepository pesos;
    private final ObjectProvider<ArmazenamentoDeFotos> armazenamento;
    private final FotosProperties propriedades;
    private final LogoRepositorio logos;
    private final Auditoria auditoria;
    private final LimiteTentativas limite;
    private final JsonMapper json;
    private final TransactionTemplate leitura;
    private final TransactionTemplate gravacao;

    public ComparacaoDeFotosService(AtualizacaoFotoRepository fotos, AlunoRepository alunos,
                                    RegistroPesoRepository pesos, ObjectProvider<ArmazenamentoDeFotos> armazenamento,
                                    FotosProperties propriedades, LogoRepositorio logos, Auditoria auditoria,
                                    LimiteTentativas limite, JsonMapper json, PlatformTransactionManager transacoes) {
        this.leitura = new TransactionTemplate(transacoes);
        this.leitura.setReadOnly(true);
        this.gravacao = new TransactionTemplate(transacoes);
        this.fotos = fotos;
        this.alunos = alunos;
        this.pesos = pesos;
        this.armazenamento = armazenamento;
        this.propriedades = propriedades;
        this.logos = logos;
        this.auditoria = auditoria;
        this.limite = limite;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public List<Item> linhaDoTempo(UUID alunoId) {
        if (alunos.findById(alunoId).isEmpty()) {
            throw new NaoEncontradoException("Aluno não encontrado.");
        }
        return montar(alunoId, AcessoAtual.pode("ANAMNESE_LER"));
    }

    @Transactional(readOnly = true)
    public List<Item> linhaDoTempoDoAluno(UsuarioAutenticado eu) {
        return montar(AlunoAppService.alunoDaSessao(eu), true);
    }

    @Transactional(readOnly = true)
    public UsoDeImagem usoDeImagem(UsuarioAutenticado eu) {
        Aluno aluno = alunos.findById(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        return new UsoDeImagem(aluno.getUsoDeImagemAutorizadoEm());
    }

    /** Só muda o que o aluno pediu, e a auditoria sai apenas quando o estado muda. */
    @Transactional
    public UsoDeImagem definirUsoDeImagem(UsuarioAutenticado eu, boolean autorizado) {
        Aluno aluno = alunos.buscarParaAlterar(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        boolean estava = aluno.getUsoDeImagemAutorizadoEm() != null;
        if (autorizado == estava) {
            return new UsoDeImagem(aluno.getUsoDeImagemAutorizadoEm());
        }
        Instant quando = autorizado ? Instant.now() : null;
        aluno.definirUsoDeImagem(quando);
        auditoria.registrarEvento(autorizado ? "USO_DE_IMAGEM_AUTORIZADO" : "USO_DE_IMAGEM_REVOGADO",
                "ALUNO", aluno.getId(), autorizado ? RESUMO_AUTORIZADO : RESUMO_REVOGADO);
        return new UsoDeImagem(quando);
    }

    /** O que a leitura do banco entrega ao resto: só chaves do bucket, nomes e a logo; nenhuma entidade. */
    private record Preparo(ArmazenamentoDeFotos bucket, List<List<String>> chavesPorImagem, List<String> posicaoPorImagem,
                           LogoRepositorio.Logo logo) {
    }

    /**
     * JPEG ou ZIP da comparação, na ordem pedida. Nada é gravado. Sem autorização do aluno, 409.
     * Foto de outro aluno, pendente, removida ou (sem {@code ANAMNESE_LER}) de anamnese: 404. Logo pedida sem arquivo: 422.
     * Cada imagem leva de 2 a 4 fotos. De 1 a 6 imagens.
     * <p>
     * NÃO é transacional, de propósito. (1) O limite conta primeiro, sem transação: a tentativa que falha continua contada.
     * (2) Uma transação curta só lê o banco. (3) O bucket, a decodificação, o desenho e o ZIP rodam sem transação nem conexão
     * do banco presa. (4) A auditoria é uma escrita curta no fim, só se a imagem foi gerada.
     */
    public ArquivoComparacao gerar(UsuarioAutenticado eu, UUID alunoId, FormatoPedido formato, boolean comLogo,
                                   List<List<UUID>> imagens) {
        limite.comparacaoDeFotos(eu.usuarioId());
        Preparo preparo = leitura.execute(status -> preparar(alunoId, comLogo, imagens));
        BufferedImage marca = preparo.logo() == null ? null : decodificar(preparo.logo().bytes(), List.of());
        List<LayoutDaComparacao.Formato> quadros = formato == FormatoPedido.AMBOS
                ? List.of(LayoutDaComparacao.Formato.STORIES, LayoutDaComparacao.Formato.FEED)
                : List.of(formato == FormatoPedido.FEED ? LayoutDaComparacao.Formato.FEED : LayoutDaComparacao.Formato.STORIES);
        List<List<String>> caminhos = new ArrayList<>();
        List<List<byte[]>> arquivos = new ArrayList<>();
        for (int q = 0; q < quadros.size(); q++) {
            caminhos.add(new ArrayList<>());
            arquivos.add(new ArrayList<>());
        }
        // Uma imagem de cada vez: cada foto pertence a uma imagem só (validarGrupos), então é baixada e decodificada uma
        // vez, mesmo com os dois formatos, e só as fotos da imagem em curso ficam na memória.
        for (int i = 0; i < preparo.chavesPorImagem().size(); i++) {
            List<String> chaves = preparo.chavesPorImagem().get(i);
            List<BufferedImage> fotosDaImagem = new ArrayList<>();
            for (int j = 0; j < chaves.size(); j++) {
                fotosDaImagem.add(decodificar(preparo.bucket().ler(chaves.get(j)), alvosDaFoto(quadros, chaves.size(), j)));
            }
            for (int q = 0; q < quadros.size(); q++) {
                LayoutDaComparacao.Formato quadro = quadros.get(q);
                LayoutDaComparacao.Layout layout = LayoutDaComparacao.montar(quadro, fotosDaImagem.size(), marca != null,
                        marca == null ? 0 : marca.getWidth(), marca == null ? 0 : marca.getHeight());
                String pasta = quadro == LayoutDaComparacao.Formato.STORIES ? "Stories" : "Feed";
                caminhos.get(q).add(pasta + "/" + nomeDaEntrada(i + 1, preparo.posicaoPorImagem().get(i)));
                arquivos.get(q).add(desenhar(layout, fotosDaImagem, marca));
            }
        }
        ArquivoComparacao arquivo;
        if (imagens.size() == 1 && formato != FormatoPedido.AMBOS) {
            String nome = formato == FormatoPedido.FEED ? "feed.jpg" : "stories.jpg";
            arquivo = new ArquivoComparacao(arquivos.get(0).get(0), nome, MediaType.IMAGE_JPEG);
        } else {
            arquivo = new ArquivoComparacao(zip(caminhos.stream().flatMap(List::stream).toList(),
                    arquivos.stream().flatMap(List::stream).toList()), "comparacao.zip", MediaType.parseMediaType("application/zip"));
        }
        gravacao.executeWithoutResult(status ->
                auditoria.registrarEvento("COMPARACAO_DE_FOTOS_GERADA", "ALUNO", alunoId, RESUMO_GERADA));
        return arquivo;
    }

    /**
     * Tudo o que precisa do banco, numa transação curta e somente leitura. A ordem das recusas é a de sempre:
     * aluno (404), autorização de uso (409), quantidades (400), logo (422), bucket (503), fotos (404).
     */
    private Preparo preparar(UUID alunoId, boolean comLogo, List<List<UUID>> imagens) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.getUsoDeImagemAutorizadoEm() == null) {
            throw new ConflictException("O aluno não autorizou o uso das fotos.", "USO_DE_IMAGEM_NAO_AUTORIZADO");
        }
        validarGrupos(imagens);
        boolean comAnamnese = AcessoAtual.pode("ANAMNESE_LER");
        Map<UUID, String> posicoes = new HashMap<>();
        for (Item item : montar(alunoId, comAnamnese)) {
            posicoes.put(item.fotoId(), item.posicao());
        }
        LogoRepositorio.Logo logo = null;
        if (comLogo) {
            logo = logos.ler(TenantContext.get()).orElseThrow(() -> new ValidacaoException(
                    "A consultoria não tem logo.", "SEM_LOGO", List.of()));
        }
        ArmazenamentoDeFotos bucket = propriedades.habilitado() ? armazenamento.getIfAvailable() : null;
        if (bucket == null) {
            throw FotoException.indisponivel();
        }
        List<List<String>> chaves = new ArrayList<>();
        List<String> posicaoPorImagem = new ArrayList<>();
        for (List<UUID> ids : imagens) {
            List<String> daImagem = new ArrayList<>();
            for (UUID id : ids) {
                daImagem.add(ObjetoDeFoto.de(carregar(alunoId, id, comAnamnese)).chave());
            }
            chaves.add(List.copyOf(daImagem));
            posicaoPorImagem.add(posicoes.get(ids.getFirst()));
        }
        return new Preparo(bucket, List.copyOf(chaves), posicaoPorImagem, logo);
    }

    /** Os lugares que a foto {@code indice} ocupa, um por formato pedido: a decodificação serve a todos. */
    private static List<Alvo> alvosDaFoto(List<LayoutDaComparacao.Formato> quadros, int fotosNaImagem, int indice) {
        List<Alvo> alvos = new ArrayList<>();
        for (LayoutDaComparacao.Formato quadro : quadros) {
            LayoutDaComparacao.Retangulo lugar = LayoutDaComparacao.montar(quadro, fotosNaImagem, false, 0, 0).fotos().get(indice);
            alvos.add(new Alvo(lugar.largura(), lugar.altura()));
        }
        return alvos;
    }

    private static void validarGrupos(List<List<UUID>> imagens) {
        if (imagens == null || imagens.isEmpty() || imagens.size() > 6) {
            throw new br.com.plataforma.comum.web.BadRequestException("A comparação usa de 1 a 6 imagens.");
        }
        Set<UUID> vistos = new HashSet<>();
        for (List<UUID> ids : imagens) {
            if (ids == null || ids.size() < 2 || ids.size() > 4 || ids.contains(null) || new HashSet<>(ids).size() != ids.size()) {
                throw new br.com.plataforma.comum.web.BadRequestException("Cada imagem usa de 2 a 4 fotos.");
            }
            for (UUID id : ids) {
                if (!vistos.add(id)) {
                    throw new br.com.plataforma.comum.web.BadRequestException("Cada imagem usa de 2 a 4 fotos.");
                }
            }
        }
    }

    /** Foto de anamnese sem {@code ANAMNESE_LER} é "não encontrada", como a de outro aluno: não revela que existe. */
    private AtualizacaoFoto carregar(UUID alunoId, UUID id, boolean comAnamnese) {
        return fotos.findById(id).filter(f -> alunoId.equals(f.getAlunoId())
                        && f.getPerguntaId() != null && f.getRemovidaEm() == null
                        && (comAnamnese || f.getAnamneseId() == null))
                .orElseThrow(() -> new NaoEncontradoException("Foto não encontrada."));
    }

    /**
     * {@code 01-frente.jpg}. Pose conhecida vira nome curto; o resto vira slug.
     * Só letras, números e hífen, para o nome não sair da pasta do ZIP.
     */
    static String nomeDaEntrada(int ordem, String posicao) {
        String pose = poseDoTexto(posicao);
        String normal = pose != null ? pose : slug(posicao);
        return "%02d-%s.jpg".formatted(ordem, normal);
    }

    /** frente, costas, lado-esquerdo, lado ou lado-direito. Palavra inteira: "colados" não vira lado. */
    static String poseDoTexto(String posicao) {
        Set<String> palavras = new HashSet<>();
        for (String palavra : semAcento(posicao).split("[^a-z0-9]+")) {
            if (!palavra.isEmpty()) {
                palavras.add(palavra);
            }
        }
        if (palavras.contains("livre")) {
            return null;
        }
        boolean lado = palavras.contains("lado");
        if (lado && palavras.contains("esquerdo")) {
            return "lado-esquerdo";
        }
        if (lado && palavras.contains("direito")) {
            return "lado-direito";
        }
        if (lado) {
            return "lado";
        }
        if (palavras.contains("frente")) {
            return "frente";
        }
        if (palavras.contains("costas")) {
            return "costas";
        }
        return null;
    }

    private static String slug(String posicao) {
        String normal = semAcento(posicao).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        return normal.isBlank() ? "foto" : normal;
    }

    private static String semAcento(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        return Normalizer.normalize(texto, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT)
                .replace('-', ' ')
                .replace('_', ' ');
    }

    /** {@code comAnamnese} falso omite as fotos de anamnese (a equipe sem {@code ANAMNESE_LER}); o aluno vê as próprias. */
    private List<Item> montar(UUID alunoId, boolean comAnamnese) {
        Map<LocalDate, BigDecimal> pesosDoDia = new HashMap<>();
        for (RegistroPeso peso : pesos.findByAlunoIdOrderByDataAsc(alunoId)) {
            pesosDoDia.putIfAbsent(peso.getData(), peso.getPesoKg());
        }
        List<Item> itens = new ArrayList<>();
        for (LinhaDaFoto linha : fotos.linhaDoTempo(alunoId)) {
            Item item = itemDe(linha, pesosDoDia);
            if (item != null && (comAnamnese || !"ANAMNESE".equals(item.origem()))) {
                itens.add(item);
            }
        }
        itens.sort(Comparator.comparing(Item::data).thenComparingInt(Item::ordem).thenComparing(Item::fotoId));
        return itens;
    }

    private Item itemDe(LinhaDaFoto linha, Map<LocalDate, BigDecimal> pesosDoDia) {
        if (linha.atualizacaoId() != null && ("ENVIADA".equals(linha.estadoAtualizacao()) || "REVISADA".equals(linha.estadoAtualizacao()))) {
            LocalDate data = linha.dataAtualizacao();
            return new Item(linha.fotoId(), "ATUALIZACAO", linha.atualizacaoId(), data, linha.perguntaId(),
                    rotulo(linha.conteudoAtualizacao(), linha.perguntaId()),
                    ordem(linha.respostasAtualizacao(), linha.perguntaId(), linha.fotoId()),
                    data == null ? null : pesosDoDia.get(data));
        }
        if (linha.anamneseId() != null && (linha.situacaoAnamnese() == Anamnese.Situacao.ENVIADA
                || linha.situacaoAnamnese() == Anamnese.Situacao.REVISADA) && linha.enviadaAnamnese() != null) {
            LocalDate data = linha.enviadaAnamnese().atZone(Fuso.BRASILIA).toLocalDate();
            return new Item(linha.fotoId(), "ANAMNESE", linha.anamneseId(), data, linha.perguntaId(),
                    rotulo(linha.conteudoAnamnese(), linha.perguntaId()),
                    ordem(linha.respostasAnamnese(), linha.perguntaId(), linha.fotoId()),
                    pesosDoDia.get(data));
        }
        return null;
    }

    private String rotulo(String conteudo, String perguntaId) {
        if (conteudo == null || conteudo.isBlank()) {
            return perguntaId;
        }
        JsonNode raiz = json.readTree(conteudo);
        for (JsonNode secao : raiz.path("secoes")) {
            for (JsonNode pergunta : secao.path("perguntas")) {
                if (perguntaId.equals(pergunta.path("id").asString())) {
                    String texto = pergunta.path("rotulo").asString("");
                    return texto.isBlank() ? perguntaId : texto;
                }
            }
        }
        return perguntaId;
    }

    private int ordem(String respostas, String perguntaId, UUID fotoId) {
        if (respostas == null || respostas.isBlank()) {
            return 0;
        }
        JsonNode lista = json.readTree(respostas).path(perguntaId);
        int i = 0;
        for (JsonNode item : lista) {
            if (fotoId.toString().equalsIgnoreCase(item.asString())) {
                return i;
            }
            i++;
        }
        return 0;
    }

    /** Tamanho em que a foto vai aparecer na imagem final. */
    record Alvo(int largura, int altura) {
    }

    /**
     * Decodifica uma vez, já reduzida: se a foto é muito maior do que o maior lugar que ela vai ocupar, o leitor pula
     * linhas e colunas inteiras (subamostragem) e o bitmap grande nem chega a existir. O fator é inteiro e nunca passa de
     * quantas vezes a foto excede o lugar, então o recorte que cobre o lugar continua com pelo menos o tamanho dele e o
     * {@code recorte} só reduz o que sobra (menos de 2x). Sem alvos (a logo), decodifica inteira. Lê de um fluxo em
     * memória: nenhum arquivo temporário.
     */
    static BufferedImage decodificar(byte[] bytes, List<Alvo> alvos) {
        try (ImageInputStream entrada = new MemoryCacheImageInputStream(new ByteArrayInputStream(bytes))) {
            Iterator<ImageReader> leitores = ImageIO.getImageReaders(entrada);
            if (!leitores.hasNext()) {
                throw imagemInvalida();
            }
            ImageReader leitor = leitores.next();
            try {
                leitor.setInput(entrada, true, true);
                ImageReadParam parametros = leitor.getDefaultReadParam();
                int passo = passoDeSubamostragem(leitor.getWidth(0), leitor.getHeight(0), alvos);
                if (passo > 1) {
                    parametros.setSourceSubsampling(passo, passo, 0, 0);
                }
                BufferedImage imagem = leitor.read(0, parametros);
                if (imagem == null) {
                    throw imagemInvalida();
                }
                return imagem;
            } finally {
                leitor.dispose();
            }
        } catch (ValidacaoException e) {
            throw e;
        } catch (IOException | RuntimeException e) {
            throw imagemInvalida();
        }
    }

    /** Quantas vezes a foto excede o menor lugar necessário (cobrir o lugar), arredondado para baixo; no mínimo 1. */
    static int passoDeSubamostragem(int largura, int altura, List<Alvo> alvos) {
        double menor = Double.MAX_VALUE;
        for (Alvo alvo : alvos) {
            if (alvo.largura() > 0 && alvo.altura() > 0) {
                menor = Math.min(menor, Math.min(largura / (double) alvo.largura(), altura / (double) alvo.altura()));
            }
        }
        return menor == Double.MAX_VALUE ? 1 : (int) Math.max(1, Math.floor(menor));
    }

    private static ValidacaoException imagemInvalida() {
        return new ValidacaoException("Não foi possível montar a imagem.", "IMAGEM_INVALIDA", List.of());
    }

    private static byte[] desenhar(LayoutDaComparacao.Layout layout, List<BufferedImage> fotos, BufferedImage logo) {
        BufferedImage quadro = new BufferedImage(layout.largura(), layout.altura(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = quadro.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.setColor(Color.BLACK);
            g.fillRect(0, 0, layout.largura(), layout.altura());
            for (int i = 0; i < fotos.size(); i++) {
                LayoutDaComparacao.Retangulo lugar = layout.fotos().get(i);
                g.drawImage(recorte(fotos.get(i), lugar.largura(), lugar.altura()), lugar.x(), lugar.y(), null);
            }
            if (logo != null && layout.logo() != null) {
                LayoutDaComparacao.Retangulo lugar = layout.logo();
                g.drawImage(logo, lugar.x(), lugar.y(), lugar.largura(), lugar.altura(), null);
            }
        } finally {
            g.dispose();
        }
        return JpegSemMetadados.limpar(jpeg(quadro));
    }

    private static byte[] zip(List<String> caminhos, List<byte[]> arquivos) {
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(saida)) {
            for (int i = 0; i < caminhos.size(); i++) {
                zip.putNextEntry(new ZipEntry(caminhos.get(i)));
                zip.write(arquivos.get(i));
                zip.closeEntry();
            }
        } catch (IOException e) {
            throw new ValidacaoException("Não foi possível montar a imagem.", "IMAGEM_INVALIDA", List.of());
        }
        return saida.toByteArray();
    }

    /** Recorte central que cobre o lugar, já no tamanho dele. */
    private static BufferedImage recorte(BufferedImage origem, int destinoLargura, int destinoAltura) {
        int largura = origem.getWidth();
        int altura = origem.getHeight();
        double alvo = destinoLargura / (double) destinoAltura;
        int recorteLargura;
        int recorteAltura;
        int x;
        int y;
        if (largura / (double) altura > alvo) {
            recorteAltura = altura;
            recorteLargura = Math.max(1, (int) Math.round(altura * alvo));
            x = (largura - recorteLargura) / 2;
            y = 0;
        } else {
            recorteLargura = largura;
            recorteAltura = Math.max(1, (int) Math.round(largura / alvo));
            x = 0;
            y = Math.max(0, (altura - recorteAltura) / 2);
        }
        BufferedImage saida = new BufferedImage(destinoLargura, destinoAltura, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = saida.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(origem, 0, 0, destinoLargura, destinoAltura, x, y, x + recorteLargura, y + recorteAltura, null);
        } finally {
            g.dispose();
        }
        return saida;
    }

    private static byte[] jpeg(BufferedImage imagem) {
        Iterator<ImageWriter> escritores = ImageIO.getImageWritersByFormatName("jpeg");
        if (!escritores.hasNext()) {
            throw new ValidacaoException("Não foi possível montar a imagem.", "IMAGEM_INVALIDA", List.of());
        }
        ImageWriter escritor = escritores.next();
        ByteArrayOutputStream saida = new ByteArrayOutputStream();
        try {
            escritor.setOutput(new MemoryCacheImageOutputStream(saida));
            ImageWriteParam parametros = escritor.getDefaultWriteParam();
            parametros.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
            parametros.setCompressionQuality(0.9f);
            escritor.write(null, new IIOImage(imagem, null, null), parametros);
            return saida.toByteArray();
        } catch (IOException e) {
            throw new ValidacaoException("Não foi possível montar a imagem.", "IMAGEM_INVALIDA", List.of());
        } finally {
            escritor.dispose();
        }
    }
}
