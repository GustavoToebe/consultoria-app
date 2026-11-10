package br.com.treinos.api.comunidade;

import br.com.plataforma.comum.web.ApiError;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConquistaResponse;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PerfilPreferenciasRequest;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PerfilPreferenciasResponse;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.JsonNode;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Preferências do próprio perfil na comunidade (V070; plano {@code perfil-estilo-steam}, passo 3): reservar o perfil, até 4
 * destaques (só tipos de conquista que o aluno já ganhou, com ordem), cor e moldura. Sempre o aluno da sessão. Nada daqui vai
 * a log, auditoria ou mensagem de erro: a auditoria leva resumo fixo e só sai quando algo muda.
 */
@Service
public class PerfilDoAlunoService {

    static final int MAXIMO_DE_DESTAQUES = 4;
    /** Resumo fixo: nunca os valores escolhidos. */
    static final String RESUMO_ALTERADO = "O aluno alterou as preferências do próprio perfil na comunidade.";

    private final AlunoRepository alunos;
    private final ConquistaAlunoRepository conquistas;
    private final ComunidadeService comunidade;
    private final Auditoria auditoria;

    public PerfilDoAlunoService(AlunoRepository alunos, ConquistaAlunoRepository conquistas, ComunidadeService comunidade,
                                Auditoria auditoria) {
        this.alunos = alunos;
        this.conquistas = conquistas;
        this.comunidade = comunidade;
        this.auditoria = auditoria;
    }

    /** Leitura pura: as opções de destaque são as conquistas já gravadas (quem as grava é {@code GET /aluno/comunidade/conquistas}). */
    @Transactional(readOnly = true)
    public PerfilPreferenciasResponse obter(UsuarioAutenticado eu) {
        Aluno aluno = alunos.findById(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        return resposta(aluno);
    }

    /**
     * Substitui as quatro preferências. Antes de conferir os destaques, reavalia as conquistas do aluno (idempotente), para
     * não recusar um tipo que ele já merece mas ainda não abriu a tela de conquistas. Erros: 422 {@code PERFIL_INVALIDO} com o
     * campo ({@code destaques}, {@code cor}, {@code moldura}) e mensagem fixa; anonimizado = 409 {@code ALUNO_ANONIMIZADO}.
     */
    @Transactional
    public PerfilPreferenciasResponse alterar(UsuarioAutenticado eu, PerfilPreferenciasRequest pedido) {
        Aluno aluno = alunos.buscarParaAlterar(AlunoAppService.alunoDaSessao(eu))
                .orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        AlunoService.exigirNaoAnonimizado(aluno);
        comunidade.avaliarConquistas(aluno.getId());
        var erros = new ArrayList<ApiError.FieldError>();
        Boolean reservado = reservado(erros, pedido.perfilReservado());
        List<String> destaques = destaques(erros, pedido.destaques(), tiposGanhos(aluno));
        CorDoPerfil cor = escolha(erros, "cor", pedido.cor(), CorDoPerfil::ler, "Escolha uma das cores da lista.");
        MolduraDoPerfil moldura = escolha(erros, "moldura", pedido.moldura(), MolduraDoPerfil::ler,
                "Escolha uma das molduras da lista.");
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira o perfil.", "PERFIL_INVALIDO", erros);
        }
        boolean mudou = !Objects.equals(reservado, aluno.getPerfilReservado())
                || !destaques.equals(aluno.getPerfilDestaques()) || cor != aluno.getPerfilCor() || moldura != aluno.getPerfilMoldura();
        if (mudou) {
            aluno.definirPerfil(reservado, destaques, cor, moldura);
            auditoria.registrarEvento("ALUNO_PERFIL_COMUNIDADE_ALTERADO", "ALUNO", aluno.getId(), RESUMO_ALTERADO);
        }
        return resposta(aluno);
    }

    /** Ausente ou de outro tipo = 422 no campo; {@code null} explícito vale (volta à regra da idade). A mensagem não repete o valor. */
    private static Boolean reservado(List<ApiError.FieldError> erros, JsonNode valor) {
        if (valor != null && valor.isNull()) {
            return null;
        }
        if (valor == null || !valor.isBoolean()) {
            erros.add(new ApiError.FieldError("perfilReservado", "Informe se o perfil fica reservado (sim, não ou a regra da idade)."));
            return null;
        }
        return valor.asBoolean();
    }

    private PerfilPreferenciasResponse resposta(Aluno aluno) {
        List<ConquistaAluno> ganhas = conquistas.findByAlunoIdOrderByConquistadaEmDesc(aluno.getId());
        Set<String> tipos = ganhas.stream().map(ConquistaAluno::getTipo).collect(Collectors.toSet());
        // Conquista não se perde, mas o filtro protege de um destaque gravado com tipo que deixou de existir.
        List<String> destaques = aluno.getPerfilDestaques().stream().filter(tipos::contains).toList();
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        return new PerfilPreferenciasResponse(aluno.getPerfilReservado(),
                RegrasDoPerfil.reservadoEfetivo(aluno.getPerfilReservado(), aluno.getDataNascimento(), hoje), destaques,
                (aluno.getPerfilCor() == null ? CorDoPerfil.PADRAO : aluno.getPerfilCor()).name(),
                (aluno.getPerfilMoldura() == null ? MolduraDoPerfil.PADRAO : aluno.getPerfilMoldura()).name(),
                ganhas.stream().map(c -> new ConquistaResponse(c.getId(), c.getTipo(), c.getTitulo(), c.getDescricao(),
                        c.getIcone(), c.getConquistadaEm())).toList());
    }

    private Set<String> tiposGanhos(Aluno aluno) {
        return conquistas.findByAlunoIdOrderByConquistadaEmDesc(aluno.getId()).stream()
                .map(ConquistaAluno::getTipo).collect(Collectors.toSet());
    }

    /** Até 4, sem repetir, cada um um {@code TipoConquista} que o aluno já ganhou; a ordem do pedido é a gravada. */
    private static List<String> destaques(List<ApiError.FieldError> erros, List<String> pedidos, Set<String> ganhos) {
        List<String> lista = pedidos == null ? List.of() : pedidos;
        if (lista.size() > MAXIMO_DE_DESTAQUES) {
            erros.add(new ApiError.FieldError("destaques", "Escolha no máximo " + MAXIMO_DE_DESTAQUES + " destaques."));
            return List.of();
        }
        if (lista.stream().distinct().count() != lista.size()) {
            erros.add(new ApiError.FieldError("destaques", "Não repita um destaque."));
            return List.of();
        }
        for (String tipo : lista) {
            if (tipo == null || !ganhos.contains(tipo)) {
                erros.add(new ApiError.FieldError("destaques", "Só dá para destacar uma conquista que você já ganhou."));
                return List.of();
            }
        }
        return List.copyOf(lista);
    }

    /** Nulo ou em branco = padrão (grava nulo); texto fora da lista = erro no campo, sem repetir o valor. */
    private static <E> E escolha(List<ApiError.FieldError> erros, String campo, String texto,
                                 java.util.function.Function<String, E> ler, String mensagem) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        E valor = ler.apply(texto);
        if (valor == null) {
            erros.add(new ApiError.FieldError(campo, mensagem));
        }
        return valor;
    }
}
