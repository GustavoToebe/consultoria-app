package br.com.treinos.api.fotos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.anamneses.Anamnese;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.LimiteTentativas;
import br.com.treinos.api.consultoria.LogoRepositorio;
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
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
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

    public ComparacaoDeFotosService(AtualizacaoFotoRepository fotos, AlunoRepository alunos,
                                    RegistroPesoRepository pesos, ObjectProvider<ArmazenamentoDeFotos> armazenamento,
                                    FotosProperties propriedades, LogoRepositorio logos, Auditoria auditoria,
                                    LimiteTentativas limite, JsonMapper json) {
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
        return montar(alunoId);
    }

    @Transactional(readOnly = true)
    public List<Item> linhaDoTempoDoAluno(UsuarioAutenticado eu) {
        return montar(AlunoAppService.alunoDaSessao(eu));
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

    /**
     * JPEG ou ZIP da comparação, na ordem pedida. Nada é gravado. Sem autorização do aluno, 409.
     * Foto de outro aluno, pendente ou removida: 404. Logo pedida sem arquivo: 422.
     * Cada imagem leva de 2 a 4 fotos. De 1 a 6 imagens.
     */
    @Transactional
    public ArquivoComparacao gerar(UsuarioAutenticado eu, UUID alunoId, FormatoPedido formato, boolean comLogo,
                                   List<List<UUID>> imagens) {
        limite.comparacaoDeFotos(eu.usuarioId());
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.getUsoDeImagemAutorizadoEm() == null) {
            throw new ConflictException("O aluno não autorizou o uso das fotos.", "USO_DE_IMAGEM_NAO_AUTORIZADO");
        }
        validarGrupos(imagens);
        Map<UUID, String> posicoes = new HashMap<>();
        for (Item item : montar(alunoId)) {
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
        BufferedImage marca = logo == null ? null : lerImagem(logo.bytes());
        List<LayoutDaComparacao.Formato> quadros = formato == FormatoPedido.AMBOS
                ? List.of(LayoutDaComparacao.Formato.STORIES, LayoutDaComparacao.Formato.FEED)
                : List.of(formato == FormatoPedido.FEED ? LayoutDaComparacao.Formato.FEED : LayoutDaComparacao.Formato.STORIES);
        List<String> caminhos = new ArrayList<>();
        List<byte[]> arquivos = new ArrayList<>();
        for (LayoutDaComparacao.Formato quadro : quadros) {
            String pasta = quadro == LayoutDaComparacao.Formato.STORIES ? "Stories" : "Feed";
            for (int i = 0; i < imagens.size(); i++) {
                List<BufferedImage> fotosDoGrupo = new ArrayList<>();
                for (UUID id : imagens.get(i)) {
                    fotosDoGrupo.add(lerImagem(bucket.ler(ObjetoDeFoto.de(carregar(alunoId, id)).chave())));
                }
                LayoutDaComparacao.Layout layout = LayoutDaComparacao.montar(quadro, fotosDoGrupo.size(), marca != null,
                        marca == null ? 0 : marca.getWidth(), marca == null ? 0 : marca.getHeight());
                caminhos.add(pasta + "/" + nomeDaEntrada(i + 1, posicoes.get(imagens.get(i).getFirst())));
                arquivos.add(desenhar(layout, fotosDoGrupo, marca));
            }
        }
        auditoria.registrarEvento("COMPARACAO_DE_FOTOS_GERADA", "ALUNO", alunoId, RESUMO_GERADA);
        if (imagens.size() == 1 && formato != FormatoPedido.AMBOS) {
            String nome = formato == FormatoPedido.FEED ? "feed.jpg" : "stories.jpg";
            return new ArquivoComparacao(arquivos.get(0), nome, MediaType.IMAGE_JPEG);
        }
        return new ArquivoComparacao(zip(caminhos, arquivos), "comparacao.zip", MediaType.parseMediaType("application/zip"));
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

    private AtualizacaoFoto carregar(UUID alunoId, UUID id) {
        return fotos.findById(id).filter(f -> alunoId.equals(f.getAlunoId())
                        && f.getPerguntaId() != null && f.getRemovidaEm() == null)
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

    private List<Item> montar(UUID alunoId) {
        Map<LocalDate, BigDecimal> pesosDoDia = new HashMap<>();
        for (RegistroPeso peso : pesos.findByAlunoIdOrderByDataAsc(alunoId)) {
            pesosDoDia.putIfAbsent(peso.getData(), peso.getPesoKg());
        }
        List<Item> itens = new ArrayList<>();
        for (LinhaDaFoto linha : fotos.linhaDoTempo(alunoId)) {
            Item item = itemDe(linha, pesosDoDia);
            if (item != null) {
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

    private static BufferedImage lerImagem(byte[] bytes) {
        try {
            BufferedImage imagem = ImageIO.read(new ByteArrayInputStream(bytes));
            if (imagem == null) {
                throw new ValidacaoException("Não foi possível montar a imagem.", "IMAGEM_INVALIDA", List.of());
            }
            return imagem;
        } catch (IOException e) {
            throw new ValidacaoException("Não foi possível montar a imagem.", "IMAGEM_INVALIDA", List.of());
        }
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
