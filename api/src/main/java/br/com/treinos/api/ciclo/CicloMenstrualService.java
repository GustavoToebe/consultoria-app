package br.com.treinos.api.ciclo;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.alunos.AlunoService;
import br.com.treinos.api.alunos.Sexo;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.UUID;

/** Guarda datas e sintomas. Não calcula fase e não recomenda nada. */
@Service
public class CicloMenstrualService {

    private static final int ANOS = 3;

    private final AlunoRepository alunos;
    private final CicloRegistroRepository registros;
    private final CicloDiaRepository dias;
    private final ConsultoriaRepository consultorias;
    private final Auditoria auditoria;
    private final JsonMapper json;

    public CicloMenstrualService(AlunoRepository alunos, CicloRegistroRepository registros, CicloDiaRepository dias,
                                 ConsultoriaRepository consultorias, Auditoria auditoria, JsonMapper json) {
        this.alunos = alunos;
        this.registros = registros;
        this.dias = dias;
        this.consultorias = consultorias;
        this.auditoria = auditoria;
        this.json = json;
    }

    @Transactional(readOnly = true)
    public CicloDtos.CicloDaAluna daAluna(UUID alunoId) {
        Aluno aluno = buscar(alunoId);
        if (aluno.getSexo() != Sexo.FEMININO) {
            return CicloDtos.CicloDaAluna.indisponivel();
        }
        LocalDate desde = hoje().minusMonths(24);
        return new CicloDtos.CicloDaAluna(true, aluno.getCicloAtivadoEm() != null, CicloMenstrual.VERSAO_CONSENTIMENTO,
                aluno.getCicloDuracaoHabitual(), aluno.isCicloMostrarFases(),
                registros.findByAlunoIdAndInicioGreaterThanEqualOrderByInicioDesc(alunoId, desde).stream().map(this::registro).toList(),
                dias.findByAlunoIdAndDataGreaterThanEqualOrderByDataDesc(alunoId, desde).stream().map(this::dia).toList(),
                textos(aluno.getConsultoriaId()));
    }

    @Transactional(readOnly = true)
    public CicloDtos.CicloDoTreinador doTreinador(UUID alunoId) {
        Aluno aluno = alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
        if (aluno.getSexo() != Sexo.FEMININO || aluno.getCicloAtivadoEm() == null) {
            return CicloDtos.CicloDoTreinador.oculto();
        }
        LocalDate desde = hoje().minusMonths(24);
        return new CicloDtos.CicloDoTreinador(true, aluno.getCicloDuracaoHabitual(), aluno.isCicloMostrarFases(),
                registros.findByAlunoIdAndInicioGreaterThanEqualOrderByInicioDesc(alunoId, desde).stream().map(this::registro).toList(),
                dias.findByAlunoIdAndDataGreaterThanEqualOrderByDataDesc(alunoId, desde).stream().map(this::dia).toList());
    }

    @Transactional
    public CicloDtos.CicloDaAluna ativar(UUID alunoId, CicloDtos.AtivarCiclo pedido) {
        Aluno aluno = exigirFeminino(alunoId);
        if (pedido.consentimentoVersao() != CicloMenstrual.VERSAO_CONSENTIMENTO) {
            throw new ConflictException("Aceite o texto atual para ligar o acompanhamento.", "CICLO_CONSENTIMENTO_DESATUALIZADO");
        }
        if (aluno.getCicloAtivadoEm() == null) {
            aluno.ativarCiclo(Instant.now(), CicloMenstrual.VERSAO_CONSENTIMENTO, pedido.duracaoHabitual());
            auditoria.registrarEvento("CICLO_ACOMPANHAMENTO_ATIVADO", "ALUNO", alunoId, "A aluna ligou o acompanhamento do ciclo.");
        } else if (pedido.duracaoHabitual() != null) {
            aluno.configurarCiclo(pedido.duracaoHabitual(), aluno.isCicloMostrarFases());
        }
        return daAluna(alunoId);
    }

    @Transactional
    public CicloDtos.CicloDaAluna desativar(UUID alunoId) {
        Aluno aluno = exigirFeminino(alunoId);
        if (desligar(aluno)) {
            auditoria.registrarEvento("CICLO_ACOMPANHAMENTO_DESATIVADO", "ALUNO", alunoId, "O acompanhamento do ciclo foi desligado.");
        }
        return daAluna(alunoId);
    }

    @Transactional
    public CicloDtos.CicloDaAluna configurar(UUID alunoId, CicloDtos.ConfiguracaoCiclo pedido) {
        Aluno aluno = exigirLigado(alunoId);
        aluno.configurarCiclo(pedido.duracaoHabitual(), pedido.mostrarFases());
        return daAluna(alunoId);
    }

    @Transactional
    public CicloDtos.RegistroCiclo gravarRegistro(UUID alunoId, CicloDtos.RegistroRequest pedido) {
        exigirLigado(alunoId);
        validarPeriodo(pedido.inicio(), pedido.fim());
        CicloRegistro existente = registros.findById(pedido.id()).orElse(null);
        if (existente != null) {
            if (!existente.getAlunoId().equals(alunoId)) {
                throw new NaoEncontradoException("Registro não encontrado.");
            }
            if (existente.mesmoConteudo(pedido.inicio(), pedido.fim())) {
                return registro(existente);
            }
            throw new ConflictException("Este registro já foi gravado.", "CONFLITO_EDICAO");
        }
        exigirSemSobreposicao(alunoId, pedido.id(), pedido.inicio(), pedido.fim());
        return registro(registros.save(new CicloRegistro(pedido.id(), alunoId, pedido.inicio(), pedido.fim())));
    }

    @Transactional
    public CicloDtos.RegistroCiclo alterarRegistro(UUID alunoId, UUID id, CicloDtos.RegistroRequest pedido) {
        exigirLigado(alunoId);
        CicloRegistro registro = registros.findById(id).filter(r -> r.getAlunoId().equals(alunoId))
                .orElseThrow(() -> new NaoEncontradoException("Registro não encontrado."));
        validarPeriodo(pedido.inicio(), pedido.fim());
        exigirSemSobreposicao(alunoId, id, pedido.inicio(), pedido.fim());
        registro.alterar(pedido.inicio(), pedido.fim());
        return registro(registro);
    }

    @Transactional
    public void apagarRegistro(UUID alunoId, UUID id) {
        exigirLigado(alunoId);
        CicloRegistro registro = registros.findById(id).orElse(null);
        if (registro == null) {
            return;
        }
        if (!registro.getAlunoId().equals(alunoId)) {
            throw new NaoEncontradoException("Registro não encontrado.");
        }
        registros.delete(registro);
    }

    /** A titular apaga os próprios dados com qualquer sexo: o sexo pode ter mudado depois de ela gravar. */
    @Transactional
    public void apagarTudo(UUID alunoId) {
        Aluno aluno = buscar(alunoId);
        AlunoService.exigirNaoAnonimizado(aluno);
        registros.apagarDoAluno(alunoId);
        dias.apagarDoAluno(alunoId);
        desligar(aluno);
        auditoria.registrarEvento("CICLO_REGISTROS_APAGADOS", "ALUNO", alunoId, "A aluna apagou os registros do ciclo.");
    }

    @Transactional
    public CicloDtos.DiaCiclo gravarDia(UUID alunoId, LocalDate data, CicloDtos.DiaRequest pedido) {
        exigirLigado(alunoId);
        validarData(data, "data");
        DiaNormalizado normal = normalizarDia(pedido);
        // O id é do cliente, como no registro: de outra aluna é 404 e nada é tocado; de outro dia da mesma aluna é conflito
        // (o dia é identificado por aluna e data, e reaproveitar o id sobrescreveria o outro dia).
        CicloDia doId = dias.findById(pedido.id()).orElse(null);
        if (doId != null) {
            if (!doId.getAlunoId().equals(alunoId)) {
                throw new NaoEncontradoException("Registro não encontrado.");
            }
            if (!doId.getData().equals(data)) {
                throw new ConflictException("Este registro já foi gravado.", "CONFLITO_EDICAO");
            }
        }
        CicloDia existente = dias.findByAlunoIdAndData(alunoId, data).orElse(null);
        if (existente != null) {
            if (existente.mesmoConteudo(normal.fluxo(), normal.colica(), normal.sintomas(), normal.observacao())) {
                return dia(existente);
            }
            existente.substituir(normal.fluxo(), normal.colica(), normal.sintomas(), normal.observacao());
            return dia(existente);
        }
        return dia(dias.save(new CicloDia(pedido.id(), alunoId, data, normal.fluxo(), normal.colica(), normal.sintomas(), normal.observacao())));
    }

    @Transactional
    public void apagarDia(UUID alunoId, LocalDate data) {
        exigirLigado(alunoId);
        dias.findByAlunoIdAndData(alunoId, data).ifPresent(dias::delete);
    }

    /** Sexo deixou de ser feminino: desliga na mesma transação. Os registros ficam, invisíveis. */
    @Transactional(propagation = Propagation.MANDATORY)
    public void desligarSeDeixouDeSerFeminino(Aluno aluno) {
        if (aluno.getSexo() == Sexo.FEMININO) {
            return;
        }
        if (desligar(aluno)) {
            auditoria.registrarEvento("CICLO_ACOMPANHAMENTO_DESATIVADO", "ALUNO", aluno.getId(), "O acompanhamento do ciclo foi desligado.");
        }
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarNaAnonimizacao(UUID alunoId) {
        registros.apagarDoAluno(alunoId);
        dias.apagarDoAluno(alunoId);
    }

    @Transactional(readOnly = true)
    public CicloDtos.CicloExportado exportar(UUID alunoId) {
        Aluno aluno = buscar(alunoId);
        return new CicloDtos.CicloExportado(aluno.getCicloAtivadoEm() != null, aluno.getCicloConsentimentoVersao(),
                aluno.getCicloAtivadoEm(), aluno.getCicloDuracaoHabitual(), aluno.isCicloMostrarFases(),
                registros.findByAlunoIdOrderByInicioAsc(alunoId).stream().map(this::registro).toList(),
                dias.findByAlunoIdAndDataGreaterThanEqualOrderByDataDesc(alunoId, LocalDate.of(1900, 1, 1)).stream().map(this::dia).toList());
    }

    public String textosParaGravar(CicloDtos.TextosDasFases textos) {
        if (textos == null) {
            return null;
        }
        CicloDtos.TextosDasFases limpos = new CicloDtos.TextosDasFases(
                texto(textos.menstrual(), "menstrual"), texto(textos.folicular(), "folicular"),
                texto(textos.ovulatoria(), "ovulatoria"), texto(textos.lutea(), "lutea"));
        if (limpos.menstrual() == null && limpos.folicular() == null && limpos.ovulatoria() == null && limpos.lutea() == null) {
            return null;
        }
        return json.writeValueAsString(limpos);
    }

    public CicloDtos.TextosDasFases textos(UUID consultoriaId) {
        Consultoria consultoria = consultorias.findById(consultoriaId).orElse(null);
        if (consultoria == null || consultoria.getTextosFasesCiclo() == null) {
            return new CicloDtos.TextosDasFases(null, null, null, null);
        }
        return json.readValue(consultoria.getTextosFasesCiclo(), CicloDtos.TextosDasFases.class);
    }

    private Aluno exigirFeminino(UUID alunoId) {
        Aluno aluno = buscar(alunoId);
        AlunoService.exigirNaoAnonimizado(aluno);
        if (aluno.getSexo() != Sexo.FEMININO) {
            throw new ConflictException("O acompanhamento do ciclo não está disponível.", "CICLO_INDISPONIVEL");
        }
        return aluno;
    }

    private Aluno exigirLigado(UUID alunoId) {
        Aluno aluno = exigirFeminino(alunoId);
        if (aluno.getCicloAtivadoEm() == null) {
            throw new ConflictException("O acompanhamento do ciclo está desligado.", "CICLO_DESLIGADO");
        }
        return aluno;
    }

    private Aluno buscar(UUID alunoId) {
        return alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
    }

    private static boolean desligar(Aluno aluno) {
        if (aluno.getCicloAtivadoEm() == null) {
            return false;
        }
        aluno.desligarCiclo();
        return true;
    }

    private void validarPeriodo(LocalDate inicio, LocalDate fim) {
        validarData(inicio, "inicio");
        if (fim == null) {
            return;
        }
        if (fim.isBefore(inicio) || fim.isAfter(inicio.plusDays(15)) || fim.isAfter(hoje())) {
            throw invalido("fim", "Confira o fim deste período.");
        }
    }

    private void validarData(LocalDate data, String campo) {
        LocalDate hoje = hoje();
        if (data == null || data.isAfter(hoje) || data.isBefore(hoje.minusYears(ANOS))) {
            throw invalido(campo, "Confira esta data.");
        }
    }

    private void exigirSemSobreposicao(UUID alunoId, UUID ignorar, LocalDate inicio, LocalDate fim) {
        LocalDate fimEfetivo = fim == null ? LocalDate.MAX : fim;
        for (CicloRegistro outro : registros.findByAlunoIdOrderByInicioAsc(alunoId)) {
            if (outro.getId().equals(ignorar)) {
                continue;
            }
            LocalDate outroFim = outro.getFim() == null ? LocalDate.MAX : outro.getFim();
            if (!inicio.isAfter(outroFim) && !outro.getInicio().isAfter(fimEfetivo)) {
                throw new ConflictException("Este período cruza outro já registrado.", "CICLO_SOBREPOSTO");
            }
        }
    }

    private DiaNormalizado normalizarDia(CicloDtos.DiaRequest pedido) {
        FluxoMenstrual fluxo = enumDe(pedido.fluxo(), FluxoMenstrual.class, "fluxo");
        Colica colica = enumDe(pedido.colica(), Colica.class, "colica");
        List<String> sintomas = sintomas(pedido.sintomas());
        String observacao = pedido.observacao() == null ? null : pedido.observacao().strip();
        if (observacao != null && observacao.isEmpty()) {
            observacao = null;
        }
        if (observacao != null && observacao.length() > 300) {
            throw invalido("observacao", "A observação passou do limite.");
        }
        if (fluxo == null && colica == null && sintomas.isEmpty() && observacao == null) {
            throw invalido("dia", "Marque ao menos um item, ou apague o dia.");
        }
        return new DiaNormalizado(fluxo, colica, sintomas, observacao);
    }

    private List<String> sintomas(List<String> informados) {
        if (informados == null || informados.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> unicos = new LinkedHashSet<>();
        for (String item : informados) {
            if (item == null || enumDe(item, SintomaDoCiclo.class, "sintomas") == null) {
                throw invalido("sintomas", "Confira os sintomas marcados.");
            }
            if (!unicos.add(item)) {
                throw invalido("sintomas", "Cada sintoma entra uma vez.");
            }
        }
        return List.copyOf(unicos);
    }

    private static <E extends Enum<E>> E enumDe(String valor, Class<E> tipo, String campo) {
        if (valor == null || valor.isBlank()) {
            return null;
        }
        for (E item : tipo.getEnumConstants()) {
            if (item.name().equals(valor)) {
                return item;
            }
        }
        throw invalido(campo, "Confira este campo.");
    }

    private static String texto(String valor, String campo) {
        if (valor == null) {
            return null;
        }
        String limpo = valor.strip();
        if (limpo.isEmpty()) {
            return null;
        }
        if (limpo.length() > 1000) {
            throw invalido(campo, "O texto passou do limite.");
        }
        return limpo;
    }

    private static ValidacaoException invalido(String campo, String mensagem) {
        return new ValidacaoException("Confira os campos.", "CICLO_INVALIDO", List.of(new ApiError.FieldError(campo, mensagem)));
    }

    private static LocalDate hoje() {
        return LocalDate.now(Fuso.BRASILIA);
    }

    private CicloDtos.RegistroCiclo registro(CicloRegistro r) {
        return new CicloDtos.RegistroCiclo(r.getId(), r.getInicio(), r.getFim(), r.getCriadoEm(), r.getAlteradoEm());
    }

    private CicloDtos.DiaCiclo dia(CicloDia d) {
        return new CicloDtos.DiaCiclo(d.getId(), d.getData(), nome(d.getFluxo()), nome(d.getColica()),
                new ArrayList<>(d.getSintomas()), d.getObservacao(), d.getCriadoEm(), d.getAlteradoEm());
    }

    private static String nome(Enum<?> valor) {
        return valor == null ? null : valor.name();
    }

    private record DiaNormalizado(FluxoMenstrual fluxo, Colica colica, List<String> sintomas, String observacao) { }
}
