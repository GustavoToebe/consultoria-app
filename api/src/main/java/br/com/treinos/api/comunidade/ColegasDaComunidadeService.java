package br.com.treinos.api.comunidade;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.ColegaDaComunidade;
import br.com.treinos.api.alunos.FotoPerfilService;
import br.com.treinos.api.alunos.VotanteDaComunidade;
import br.com.treinos.api.biblioteca.Exercicio;
import br.com.treinos.api.biblioteca.ExercicioRepository;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.AtividadeRecente;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ColegaDaLista;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConquistaRecente;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConquistaDoColega;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConquistaDoPerfil;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.ConquistaResponse;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.DestaqueDoPerfil;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PaginaDeColegas;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.PerfilResponse;
import br.com.treinos.api.comunidade.dto.ComunidadeDtos.RecordeDoColega;
import br.com.treinos.api.recordes.RecordesService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.sessoesconcluidas.SessaoConcluidaRepository;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Os colegas na comunidade (V070; plano {@code perfil-estilo-steam}, passos 4 a 6): perfil, foto e lista de quem não reservou o
 * perfil. {@code autorId} é o id de usuário que o mural expõe. Equipe, inexistente, inativo, anonimizado e de outra consultoria dão
 * o mesmo 404 ({@link #NAO_ENCONTRADO}); na foto, o perfil reservado e a falta de foto também (a resposta não distingue). A
 * data de nascimento decide a reserva aqui dentro e nunca sai. Só leitura: nenhuma conquista é gravada num GET.
 */
@Service
public class ColegasDaComunidadeService {

    /** A mesma mensagem em toda recusa (perfil e foto): o corpo do 404 não distingue o motivo. */
    static final String NAO_ENCONTRADO = "Perfil não encontrado.";
    private static final int TAMANHO_DA_PAGINA = 30;
    private static final int TAMANHO_MAXIMO = 100;

    private final AlunoRepository alunos;
    private final SessaoConcluidaRepository sessoes;
    private final ConquistaAlunoRepository conquistas;
    private final FotoPerfilService fotos;
    private final RecordesService recordes;
    private final ExercicioRepository exercicios;
    private final XpService xp;

    public ColegasDaComunidadeService(AlunoRepository alunos, SessaoConcluidaRepository sessoes, ConquistaAlunoRepository conquistas,
                                      FotoPerfilService fotos, RecordesService recordes, ExercicioRepository exercicios, XpService xp) {
        this.alunos = alunos;
        this.sessoes = sessoes;
        this.conquistas = conquistas;
        this.fotos = fotos;
        this.recordes = recordes;
        this.exercicios = exercicios;
        this.xp = xp;
    }

    /**
     * Perfil de um aluno ativo da mesma consultoria. Reservado (e não é o próprio aluno): só o nome (já montado) e {@code reservado}.
     * Senão traz nível (do XP; o XP em si nunca sai), insígnias, destaques, cor, moldura, foto (só se tem), atividade (só datas) e recordes de carga.
     */
    @Transactional(readOnly = true)
    public PerfilResponse perfil(UUID autorId, UsuarioAutenticado eu) {
        Aluno aluno = exigirColega(autorId);
        boolean ehVoce = autorId.equals(eu.usuarioId());
        // Rota só de aluno: o nome sai montado pela escolha do colega e o apelido, que já entrou nele, não vai à parte.
        String nome = NomeExibido.paraColegas(aluno.getExibicaoDoNome(), aluno.getNome(), aluno.getApelido());
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        boolean reservado = RegrasDoPerfil.reservadoEfetivo(aluno.getPerfilReservado(), aluno.getDataNascimento(), hoje);
        if (!RegrasDoPerfil.mostraTudo(ehVoce, reservado)) {
            return PerfilResponse.soONome(autorId, nome, null);
        }
        int treinos = (int) sessoes.countByAlunoIdAndSituacaoAndConcluidaTrue(aluno.getId(), "ACEITO");
        List<ConquistaAluno> ganhas = conquistas.findByAlunoIdOrderByConquistadaEmDesc(aluno.getId());
        // Só o próprio aluno recebe o id e o instante; o colega vê só o que a conquista é (o horário revelaria o uso do app).
        List<ConquistaDoPerfil> todas = ganhas.stream()
                .<ConquistaDoPerfil>map(c -> ehVoce
                        ? new ConquistaResponse(c.getId(), c.getTipo(), c.getTitulo(), c.getDescricao(), c.getIcone(), c.getConquistadaEm())
                        : new ConquistaDoColega(c.getTipo(), c.getTitulo(), c.getDescricao(), c.getIcone()))
                .toList();
        return new PerfilResponse(autorId, nome, null, ehVoce, reservado, treinos, xp.doAluno(aluno.getId()).nivel(),
                todas, destaques(aluno, ganhas),
                (aluno.getPerfilCor() == null ? CorDoPerfil.PADRAO : aluno.getPerfilCor()).name(),
                (aluno.getPerfilMoldura() == null ? MolduraDoPerfil.PADRAO : aluno.getPerfilMoldura()).name(),
                fotos.temFoto(aluno.getId()), atividade(aluno, ganhas, hoje), recordes(aluno));
    }

    /**
     * Foto do colega. Recusa igual ao perfil e, além disso, perfil reservado e aluno sem foto dão o MESMO 404 (quem pede não
     * descobre quem reservou nem quem não tem foto). O próprio aluno sempre vê a dele.
     */
    @Transactional(readOnly = true)
    public byte[] foto(UUID autorId, UsuarioAutenticado eu) {
        Aluno aluno = exigirColega(autorId);
        if (!podeVerAFoto(autorId.equals(eu.usuarioId()), aluno.getPerfilReservado(), aluno.getDataNascimento(),
                LocalDate.now(Fuso.BRASILIA))) {
            throw new NaoEncontradoException(NAO_ENCONTRADO);
        }
        return fotos.jpegDoColega(aluno.getId()).orElseThrow(() -> new NaoEncontradoException(NAO_ENCONTRADO));
    }

    /** A regra única da foto: o dono vê a dele; os outros, só se o perfil não está reservado (pela escolha ou pela idade). */
    private static boolean podeVerAFoto(boolean ehVoce, Boolean escolhaDoPerfil, LocalDate nascimento, LocalDate hoje) {
        return RegrasDoPerfil.mostraTudo(ehVoce, RegrasDoPerfil.reservadoEfetivo(escolhaDoPerfil, nascimento, hoje));
    }

    /**
     * Dos alunos votantes, os usuários cuja foto {@code quemPede} receberia em {@link #foto}: aluno ativo e não anonimizado, com
     * foto, e perfil não reservado (ou o próprio). É a mesma regra da rota da foto, em lote (uma consulta de fotos); equipe,
     * inativo, anonimizado e reservado ficam de fora. Quem não é aluno nem entra aqui.
     */
    @Transactional(readOnly = true)
    public Set<UUID> comFotoVisivel(java.util.Collection<VotanteDaComunidade> votantes, UUID quemPede) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        List<VotanteDaComunidade> elegiveis = votantes.stream()
                .filter(v -> v.ativo() && v.anonimizadoEm() == null
                        && podeVerAFoto(v.usuarioId().equals(quemPede), v.perfilReservado(), v.dataNascimento(), hoje))
                .toList();
        Set<UUID> comFoto = fotos.comFoto(elegiveis.stream().map(VotanteDaComunidade::alunoId).toList());
        return elegiveis.stream().filter(v -> comFoto.contains(v.alunoId())).map(VotanteDaComunidade::usuarioId)
                .collect(Collectors.toSet());
    }

    /**
     * Quem não reservou o perfil, sem o próprio aluno, por nome (sem acento) e id, paginado. Decisão: a reserva e a idade se
     * decidem em memória pela mesma regra pura do perfil ({@code RegrasDoPerfil}), sobre uma consulta só dos colegas ativos da
     * consultoria (a foto da página vem agrupada); assim {@code total} conta só os visíveis e a data de nascimento não passa de um
     * record interno. O nível sai do XP, calculado um aluno por vez na página (30 por padrão, até 100). shortcut: várias consultas
     * por colega, trocar por cálculo em lote se a lista pesar. shortcut: carrega todos os colegas ativos da consultoria a cada
     * página, trocar por filtro na consulta se uma consultoria passar de alguns milhares de alunos ativos.
     */
    @Transactional(readOnly = true)
    public PaginaDeColegas listar(UsuarioAutenticado eu, Integer pagina, Integer tamanho) {
        LocalDate hoje = LocalDate.now(Fuso.BRASILIA);
        // Ordena pelo nome que o colega escolheu mostrar: ordenar pelo completo diria a ordem dos sobrenomes.
        record Linha(ColegaDaComunidade colega, String nome) {}
        List<Linha> visiveis = alunos.colegasDaComunidade(eu.usuarioId()).stream()
                .filter(c -> !RegrasDoPerfil.reservadoEfetivo(c.perfilReservado(), c.dataNascimento(), hoje))
                .map(c -> new Linha(c, NomeExibido.paraColegas(c.exibicaoDoNome(), c.nome(), c.apelido())))
                .sorted(Comparator.comparing((Linha l) -> Buscas.semAcento(l.nome())).thenComparing(l -> l.colega().alunoId()))
                .toList();
        int tam = tamanho == null ? TAMANHO_DA_PAGINA : Math.max(1, Math.min(tamanho, TAMANHO_MAXIMO));
        long inicio = (long) Math.max(0, pagina == null ? 0 : pagina) * tam;
        List<Linha> doIntervalo = inicio >= visiveis.size() ? List.of()
                : visiveis.subList((int) inicio, (int) Math.min(visiveis.size(), inicio + tam));
        List<UUID> ids = doIntervalo.stream().map(l -> l.colega().alunoId()).toList();
        Set<UUID> comFoto = fotos.comFoto(ids);
        return new PaginaDeColegas(doIntervalo.stream()
                .map(l -> new ColegaDaLista(l.colega().usuarioId(), l.nome(), null,
                        xp.doAluno(l.colega().alunoId()).nivel(), comFoto.contains(l.colega().alunoId())))
                .toList(), visiveis.size());
    }

    private Aluno exigirColega(UUID autorId) {
        return alunos.findByUsuarioId(autorId).filter(a -> a.isAtivo() && !a.isAnonimizado())
                .orElseThrow(() -> new NaoEncontradoException(NAO_ENCONTRADO));
    }

    private static List<DestaqueDoPerfil> destaques(Aluno aluno, List<ConquistaAluno> ganhas) {
        Set<String> tipos = ganhas.stream().map(ConquistaAluno::getTipo).collect(Collectors.toSet());
        return RegrasDoPerfil.destaquesVisiveis(aluno.getPerfilDestaques(), tipos).stream()
                .map(ColegasDaComunidadeService::tipoDeConquista).filter(java.util.Objects::nonNull)
                .map(t -> new DestaqueDoPerfil(t.name(), t.titulo(), t.icone())).toList();
    }

    private AtividadeRecente atividade(Aluno aluno, List<ConquistaAluno> ganhas, LocalDate hoje) {
        List<LocalDate> dias = sessoes.diasConcluidos(aluno.getId(), RegrasDoPerfil.inicioDaAtividade(hoje), hoje);
        List<ConquistaRecente> ultimas = ganhas.stream().limit(RegrasDoPerfil.MAXIMO_DE_CONQUISTAS_RECENTES)
                .map(c -> new ConquistaRecente(c.getTipo(), c.getTitulo(), c.getIcone(),
                        c.getConquistadaEm().atZone(Fuso.BRASILIA).toLocalDate()))
                .toList();
        return new AtividadeRecente(dias, ultimas);
    }

    /** Maiores cargas (kg) por exercício; exercício que sumiu da biblioteca fica de fora em vez de aparecer sem nome. */
    private List<RecordeDoColega> recordes(Aluno aluno) {
        List<RecordesService.MaiorCarga> maiores = recordes.maioresCargas(aluno.getId(), RegrasDoPerfil.MAXIMO_DE_RECORDES);
        Map<UUID, String> nomes = exercicios.findAllById(maiores.stream().map(RecordesService.MaiorCarga::exercicioId).toList())
                .stream().collect(Collectors.toMap(Exercicio::getId, Exercicio::getNome));
        return maiores.stream().filter(m -> nomes.containsKey(m.exercicioId()))
                .map(m -> new RecordeDoColega(nomes.get(m.exercicioId()), m.carga())).toList();
    }

    private static TipoConquista tipoDeConquista(String tipo) {
        try {
            return TipoConquista.valueOf(tipo);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
