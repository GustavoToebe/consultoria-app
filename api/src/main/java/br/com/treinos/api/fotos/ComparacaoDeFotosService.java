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
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Linha do tempo das fotos já enviadas e a imagem de comparação para divulgação.
 * A imagem nasce aqui e não fica gravada: o servidor já tem os bytes, a autorização é conferida num lugar só
 * e a web e o celular recebem o mesmo JPEG, sem texto e sem EXIF.
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

    public record Pedido(List<UUID> fotoIds, boolean comLogo) {
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
     * JPEG da comparação, na ordem dos ids. Nada é gravado. Sem autorização do aluno, 409.
     * Foto de outro aluno, pendente ou removida: 404. Logo pedida sem arquivo: 422.
     */
    @Transactional
    public byte[] gerar(UsuarioAutenticado eu, UUID alunoId, List<UUID> fotoIds, boolean comLogo) {
        limite.comparacaoDeFotos(eu.usuarioId());
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.getUsoDeImagemAutorizadoEm() == null) {
            throw new ConflictException("O aluno não autorizou o uso das fotos.", "USO_DE_IMAGEM_NAO_AUTORIZADO");
        }
        if (fotoIds == null || fotoIds.size() < 2 || fotoIds.size() > 4 || new HashSet<>(fotoIds).size() != fotoIds.size()) {
            throw new br.com.plataforma.comum.web.BadRequestException("Escolha de 2 a 4 fotos.");
        }
        List<AtualizacaoFoto> escolhidas = new ArrayList<>();
        for (UUID id : fotoIds) {
            AtualizacaoFoto foto = fotos.findById(id).filter(f -> alunoId.equals(f.getAlunoId())
                            && f.getPerguntaId() != null && f.getRemovidaEm() == null)
                    .orElseThrow(() -> new NaoEncontradoException("Foto não encontrada."));
            escolhidas.add(foto);
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
        List<BufferedImage> imagens = new ArrayList<>();
        for (AtualizacaoFoto foto : escolhidas) {
            imagens.add(lerImagem(bucket.ler(ObjetoDeFoto.de(foto).chave())));
        }
        BufferedImage marca = logo == null ? null : lerImagem(logo.bytes());
        LayoutDaComparacao.Layout layout = LayoutDaComparacao.montar(imagens.size(), marca != null,
                marca == null ? 0 : marca.getWidth(), marca == null ? 0 : marca.getHeight());
        byte[] jpeg = desenhar(layout, imagens, marca);
        auditoria.registrarEvento("COMPARACAO_DE_FOTOS_GERADA", "ALUNO", alunoId, RESUMO_GERADA);
        return jpeg;
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

    /** Recorte central 4:5, já no tamanho do lugar. */
    private static BufferedImage recorte(BufferedImage origem, int destinoLargura, int destinoAltura) {
        int largura = origem.getWidth();
        int altura = origem.getHeight();
        double alvo = 4.0 / 5.0;
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
