package br.com.treinos.api.execucao;

import br.com.treinos.api.alunos.Aluno;
import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.consultoria.MetaDoPeso;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoRequest;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoResponse;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.FaixaDeData;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.UUID;

/**
 * Registro de peso (o treinador registra; o aluno só lê nesta entrega). A variação é só a diferença para o registro
 * anterior; o sistema não interpreta nem comenta o peso.
 */
@Service
public class PesoService {

    private final RegistroPesoRepository pesos;
    private final AlunoRepository alunos;
    private final ConsultoriaRepository consultorias;

    public PesoService(RegistroPesoRepository pesos, AlunoRepository alunos, ConsultoriaRepository consultorias) {
        this.pesos = pesos;
        this.alunos = alunos;
        this.consultorias = consultorias;
    }

    /** Mais recente primeiro. */
    @Transactional(readOnly = true)
    public List<PesoResponse> listar(UUID alunoId) {
        MetaDoPeso meta = metaEfetiva(exigirAluno(alunoId));
        List<PesoResponse> lista = new ArrayList<>();
        BigDecimal anterior = null;
        for (RegistroPeso p : pesos.findByAlunoIdOrderByDataAsc(alunoId)) {
            lista.add(new PesoResponse(p.getId(), p.getData(), p.getPesoKg(),
                    anterior == null ? null : p.getPesoKg().subtract(anterior), p.getObservacao(), meta));
            anterior = p.getPesoKg();
        }
        Collections.reverse(lista);
        return lista;
    }

    /**
     * Rota do próprio aluno: a observação é anotação da equipe e nunca chega a ele, então sai nula aqui no servidor
     * (o app não é a barreira).
     */
    @Transactional(readOnly = true)
    public List<PesoResponse> listarParaAluno(UUID alunoId) {
        return listar(alunoId).stream()
                .map(p -> new PesoResponse(p.id(), p.data(), p.pesoKg(), p.variacao(), null, p.metaDoPeso()))
                .toList();
    }

    /** Uma medida por dia: registrar de novo na mesma data substitui. */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PESO_REGISTRADO",entidade="PESO",resumo="Registrou ou alterou um peso.")
    public List<PesoResponse> registrar(UUID alunoId, PesoRequest r, UUID usuarioId) {
        exigirAlunoParaGravar(alunoId);
        FaixaDeData.exigir("PESO_INVALIDO", FaixaDeData.REGISTRO.campo("data", "Data do peso", r.data()));
        String observacao = Buscas.opcional(r.observacao());
        pesos.findByAlunoIdAndData(alunoId, r.data()).ifPresentOrElse(
                p -> p.alterar(r.pesoKg(), observacao, usuarioId),
                () -> pesos.save(new RegistroPeso(alunoId, r.data(), r.pesoKg(), observacao, usuarioId)));
        pesos.flush();
        return listar(alunoId);
    }

    @Transactional
    public void excluir(UUID alunoId, UUID pesoId) {
        RegistroPeso p = pesos.findByIdAndAlunoId(pesoId, alunoId)
                .orElseThrow(() -> new NaoEncontradoException("Registro de peso não encontrado."));
        pesos.delete(p);
    }

    private Aluno exigirAluno(UUID alunoId) {
        return alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado."));
    }

    /** A do aluno, senão a da consultoria (D6: o app não calcula). */
    private MetaDoPeso metaEfetiva(Aluno aluno) {
        MetaDoPeso daConsultoria = consultorias.findById(TenantContext.get()).map(Consultoria::getMetaDoPeso)
                .orElseThrow(() -> new NaoEncontradoException("Consultoria não encontrada."));
        return MetaDoPeso.efetiva(aluno.getMetaDoPeso(), daConsultoria);
    }

    /** Gravar dado novo: o aluno existe e não foi anonimizado (dado de saúde num cadastro anonimizado contraria a LGPD). */
    private void exigirAlunoParaGravar(UUID alunoId) {
        br.com.treinos.api.alunos.AlunoService.exigirNaoAnonimizado(
                alunos.findById(alunoId).orElseThrow(() -> new NaoEncontradoException("Aluno não encontrado.")));
    }
}
