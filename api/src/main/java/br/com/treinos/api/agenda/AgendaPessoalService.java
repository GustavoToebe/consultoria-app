package br.com.treinos.api.agenda;

import br.com.plataforma.comum.web.BadRequestException;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.AgendaRequest;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.AgendaResponse;
import br.com.treinos.api.agenda.AgendaCalendarioDtos.ContagemDaAgenda;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/**
 * Agendas pessoais de cada membro da equipe (D2): até {@value #AGENDAS_MAXIMO} por membro, nome único (sem diferença de
 * caixa) e cor de uma paleta fixa. O dono é sempre quem está na sessão: agenda de outro membro ou de outra consultoria =
 * 404, nunca 403. Apagar a agenda apaga os eventos dela (P4), com a contagem à parte para a confirmação.
 *
 * <p><b>Auditoria.</b> Resumo literal fixo, sem nome da agenda: o nome é texto livre do membro. Não trava a consultoria
 * (o plano dispensa); a unicidade do nome e o limite são conferidos antes e o banco decide uma corrida.
 */
@Service
public class AgendaPessoalService {

    /** Máximo de agendas pessoais por membro (D17). */
    static final int AGENDAS_MAXIMO = 20;

    private final AgendaPessoalRepository agendas;
    private final EventoAgendaRepository eventos;
    private final Auditoria auditoria;

    public AgendaPessoalService(AgendaPessoalRepository agendas, EventoAgendaRepository eventos, Auditoria auditoria) {
        this.agendas = agendas;
        this.eventos = eventos;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public List<AgendaResponse> listar(UUID dono) {
        return agendas.findByDonoId(dono).stream()
                .sorted(Comparator.comparing(AgendaPessoal::getNome, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(AgendaPessoal::getId))
                .map(AgendaPessoalService::resposta).toList();
    }

    @Transactional
    public AgendaResponse criar(UUID dono, AgendaRequest r) {
        String nome = nomeValido(r.nome());
        String cor = corValida(r.cor());
        if (agendas.countByDonoId(dono) >= AGENDAS_MAXIMO) {
            throw new ConflictException("Você já tem " + AGENDAS_MAXIMO + " agendas. Apague uma para criar outra.",
                    "LIMITE_DE_AGENDAS");
        }
        if (agendas.existsByDonoIdAndNomeIgnoreCase(dono, nome)) {
            throw nomeEmUso();
        }
        AgendaPessoal criada;
        try {
            criada = agendas.saveAndFlush(new AgendaPessoal(dono, nome, cor));
        } catch (DataIntegrityViolationException corrida) {
            throw nomeEmUso();
        }
        auditoria.registrarEvento("AGENDA_PESSOAL_CRIADA", "AGENDA_PESSOAL", criada.getId(), "Criou uma agenda pessoal.");
        return resposta(criada);
    }

    @Transactional
    public AgendaResponse alterar(UUID dono, UUID id, AgendaRequest r) {
        AgendaPessoal agenda = buscar(dono, id);
        exigirVersao(agenda, r.versao());
        String nome = nomeValido(r.nome());
        String cor = corValida(r.cor());
        if (agendas.existsByDonoIdAndNomeIgnoreCaseAndIdNot(dono, nome, id)) {
            throw nomeEmUso();
        }
        agenda.alterar(nome, cor);
        AgendaPessoal salva;
        try {
            salva = agendas.saveAndFlush(agenda);
        } catch (DataIntegrityViolationException corrida) {
            throw nomeEmUso();
        }
        auditoria.registrarEvento("AGENDA_PESSOAL_ALTERADA", "AGENDA_PESSOAL", id, "Alterou uma agenda pessoal.");
        return resposta(salva);
    }

    /** Quantos eventos (séries) seriam apagados junto: o número da confirmação. */
    @Transactional(readOnly = true)
    public ContagemDaAgenda contar(UUID dono, UUID id) {
        buscar(dono, id);
        return new ContagemDaAgenda(eventos.countByDonoIdAndAgendaId(dono, id));
    }

    /**
     * Apaga a agenda e, pelo banco ({@code ON DELETE CASCADE}), os eventos e as exceções dela. A {@code versao} é a da
     * agenda lida. A auditoria leva só a quantidade de eventos.
     */
    @Transactional
    public void apagar(UUID dono, UUID id, Long versao) {
        AgendaPessoal agenda = buscar(dono, id);
        exigirVersao(agenda, versao);
        long total = eventos.countByDonoIdAndAgendaId(dono, id);
        agendas.delete(agenda);
        agendas.flush();
        auditoria.registrarEvento("AGENDA_PESSOAL_APAGADA", "AGENDA_PESSOAL", id, "Apagou uma agenda pessoal e "
                + total + (total == 1 ? " evento dela." : " eventos dela."));
    }

    /** A agenda do dono (senão 404): usada também pelo serviço de eventos. */
    AgendaPessoal buscar(UUID dono, UUID id) {
        return agendas.findByIdAndDonoId(id, dono).orElseThrow(() -> new NaoEncontradoException("Agenda não encontrada."));
    }

    private static AgendaResponse resposta(AgendaPessoal a) {
        return new AgendaResponse(a.getId(), a.getNome(), a.getCor(), a.getVersao() == null ? 0 : a.getVersao());
    }

    private static void exigirVersao(AgendaPessoal a, Long versao) {
        if (versao == null || !versao.equals(a.getVersao())) {
            throw new ConflictException("Outra pessoa ou aba alterou esta agenda. Recarregue para ver a versão atual.",
                    "CONFLITO_EDICAO");
        }
    }

    private static String nomeValido(String nome) {
        String limpo = nome == null ? "" : nome.trim();
        if (limpo.isEmpty() || limpo.length() > AgendaCalendarioDtos.NOME_DA_AGENDA_MAXIMO) {
            throw new BadRequestException("O nome da agenda precisa ter de 1 a " + AgendaCalendarioDtos.NOME_DA_AGENDA_MAXIMO
                    + " caracteres.", "AGENDA_INVALIDA");
        }
        return limpo;
    }

    private static String corValida(String cor) {
        String chave = cor == null ? "" : cor.trim().toUpperCase(Locale.ROOT);
        if (!AgendaCalendarioDtos.CORES.contains(chave)) {
            throw new BadRequestException("Escolha uma das cores da lista.", "COR_INVALIDA");
        }
        return chave;
    }

    private static ConflictException nomeEmUso() {
        return new ConflictException("Você já tem uma agenda com esse nome.", "AGENDA_NOME_EM_USO");
    }
}
