package br.com.treinos.api.questionarios;

import br.com.treinos.api.consultoria.MarcaService;
import br.com.treinos.api.consultoria.PngSemMetadados;
import br.com.treinos.api.fotos.JpegSemMetadados;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Imagens das perguntas e das opções. PNG ou JPEG pelos bytes (o tipo declarado não conta; SVG é recusado), regravadas
 * sem metadados e pequenas, porque ficam no banco. Imagem que nenhum rascunho nem versão publicada cita sai ao publicar ou
 * excluir um questionário (só as com mais de um dia: a recém-enviada ainda pode estar só na tela do editor).
 */
@Service
public class QuestionarioImagemService {

    /** O corpo da requisição já é limitado a 1 MiB; aqui o limite do que chega antes de limpar. */
    static final int BYTES_RECEBIDOS = 1_000_000;
    static final Duration CARENCIA_DA_ORFA = Duration.ofDays(1);
    /**
     * Teto de imagens novas por consultoria em 24 h (revisão de segurança de 19/10). As imagens ficam no banco e a órfã só
     * sai ao publicar ou excluir um questionário: sem teto, um cliente com {@code QUESTIONARIO_ALTERAR} enchia o banco
     * de todas as consultorias com envios de 300 KB. Cem por dia cobre com folga montar vários questionários.
     */
    static final int POR_DIA = 100;
    private static final Pattern UUID_NO_TEXTO = Pattern.compile(LimitesQuestionario.IMAGEM_PADRAO);

    /** Bytes e tipo, para a resposta da rota. */
    public static final class Imagem {
        private final String tipo;
        private final byte[] bytes;

        Imagem(String tipo, byte[] bytes) {
            this.tipo = tipo;
            this.bytes = bytes.clone();
        }

        public ResponseEntity<byte[]> resposta() {
            return ResponseEntity.ok()
                    .contentType(MediaType.parseMediaType(tipo))
                    .cacheControl(CacheControl.noStore())
                    .header("X-Content-Type-Options", "nosniff")
                    .header("Content-Disposition", "inline")
                    .body(bytes.clone());
        }
    }

    private final QuestionarioImagemRepository imagens;
    private final QuestionarioRepository questionarios;
    private final QuestionarioVersaoRepository versoes;

    public QuestionarioImagemService(QuestionarioImagemRepository imagens, QuestionarioRepository questionarios,
                                     QuestionarioVersaoRepository versoes) {
        this.imagens = imagens;
        this.questionarios = questionarios;
        this.versoes = versoes;
    }

    @Transactional
    public UUID enviar(byte[] recebido) {
        if (recebido == null || recebido.length == 0) {
            throw invalida("Envie uma imagem PNG ou JPEG.");
        }
        if (recebido.length > BYTES_RECEBIDOS) {
            throw grandeDemais();
        }
        if (imagens.countByCriadaEmAfter(Instant.now().minus(Duration.ofDays(1))) >= POR_DIA) {
            throw new ValidacaoException("Limite de " + POR_DIA + " imagens por dia atingido. Tente de novo amanhã.",
                    "IMAGENS_LIMITE_DIARIO", List.of());
        }
        String tipo = MarcaService.tipoPelosBytes(recebido).orElseThrow(() -> invalida("A imagem precisa ser PNG ou JPEG."));
        byte[] limpo;
        try {
            if ("image/png".equals(tipo)) {
                if (!MarcaService.ladosDoPngCabem(recebido, LimitesQuestionario.IMAGEM_LADO)) {
                    throw invalida("A imagem pode ter no máximo " + LimitesQuestionario.IMAGEM_LADO + " px de largura e de altura.");
                }
                limpo = PngSemMetadados.limpar(recebido);
            } else {
                limpo = JpegSemMetadados.limpar(recebido, LimitesQuestionario.IMAGEM_LADO);
            }
        } catch (IllegalArgumentException quebrada) {
            throw invalida("A imagem precisa estar inteira e ter no máximo " + LimitesQuestionario.IMAGEM_LADO + " px de largura e de altura.");
        }
        if (limpo.length > LimitesQuestionario.IMAGEM_BYTES) {
            throw grandeDemais();
        }
        return imagens.saveAndFlush(new QuestionarioImagem(tipo, limpo, Instant.now())).getId();
    }

    /** Da consultoria da sessão; de outra, 404. A permissão de quem vê é conferida na rota (ou pela anamnese do aluno). */
    @Transactional(readOnly = true)
    public Imagem ler(UUID id) {
        QuestionarioImagem i = imagens.findById(id).orElseThrow(() -> new NaoEncontradoException("Imagem não encontrada."));
        return new Imagem(i.getTipo(), i.getBytes());
    }

    /** Ids citados no conteúdo que não existem na consultoria (a publicação recusa). */
    @Transactional(readOnly = true)
    public Set<UUID> inexistentes(Collection<UUID> ids) {
        if (ids.isEmpty()) {
            return Set.of();
        }
        Set<UUID> faltam = new HashSet<>(ids);
        imagens.existentes(ids).forEach(faltam::remove);
        return faltam;
    }

    /** Apaga as imagens da consultoria que nenhum rascunho nem versão publicada cita (com mais de um dia). */
    @Transactional
    public int removerOrfas() {
        List<UUID> candidatas = imagens.idsCriadosAntes(Instant.now().minus(CARENCIA_DA_ORFA));
        if (candidatas.isEmpty()) {
            return 0;
        }
        Set<UUID> usadas = new HashSet<>();
        questionarios.rascunhos().forEach(t -> usadas.addAll(citadas(t)));
        versoes.conteudos().forEach(t -> usadas.addAll(citadas(t)));
        List<UUID> orfas = candidatas.stream().filter(id -> !usadas.contains(id)).toList();
        imagens.deleteAllByIdInBatch(orfas);
        return orfas.size();
    }

    /** Todo UUID que aparece no JSON (ids de imagem são UUID; ids de pergunta e opção que coincidirem só seguram a imagem). */
    public static Set<UUID> citadas(String conteudo) {
        Set<UUID> ids = new HashSet<>();
        if (conteudo == null) {
            return ids;
        }
        Matcher m = UUID_NO_TEXTO.matcher(conteudo);
        while (m.find()) {
            ids.add(UUID.fromString(m.group()));
        }
        return ids;
    }

    /** Ids de imagem do conteúdo (perguntas e opções). */
    public static Set<UUID> imagensDo(ConteudoQuestionario c) {
        Set<UUID> ids = new HashSet<>();
        if (c.secoes() == null) {
            return ids;
        }
        for (var s : c.secoes()) {
            for (var p : s.perguntas() == null ? List.<ConteudoQuestionario.Pergunta>of() : s.perguntas()) {
                adicionar(ids, p.imagemId());
                if (p.opcoes() != null) {
                    p.opcoes().forEach(o -> adicionar(ids, o.imagemId()));
                }
            }
        }
        return ids;
    }

    private static void adicionar(Set<UUID> ids, String id) {
        if (id != null && UUID_NO_TEXTO.matcher(id).matches()) {
            ids.add(UUID.fromString(id));
        }
    }

    private static ValidacaoException invalida(String mensagem) {
        return new ValidacaoException(mensagem, "IMAGEM_INVALIDA", List.of());
    }

    private static ValidacaoException grandeDemais() {
        return new ValidacaoException("A imagem passou de 300 KB. Reduza e envie de novo.", "IMAGEM_GRANDE_DEMAIS", List.of());
    }
}
