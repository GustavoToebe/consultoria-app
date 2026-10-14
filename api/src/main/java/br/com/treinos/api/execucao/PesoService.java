package br.com.treinos.api.execucao;

import br.com.treinos.api.alunos.AlunoRepository;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoRequest;
import br.com.treinos.api.execucao.dto.ExecucaoDtos.PesoResponse;
import br.com.plataforma.comum.web.BadRequestException;
import br.com.treinos.api.web.Buscas;
import br.com.treinos.api.web.Exigir;
import br.com.treinos.api.web.Fuso;
import br.com.treinos.api.web.NaoEncontradoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
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

    public PesoService(RegistroPesoRepository pesos, AlunoRepository alunos) {
        this.pesos = pesos;
        this.alunos = alunos;
    }

    /** Mais recente primeiro. */
    @Transactional(readOnly = true)
    public List<PesoResponse> listar(UUID alunoId) {
        exigirAluno(alunoId);
        List<PesoResponse> lista = new ArrayList<>();
        BigDecimal anterior = null;
        for (RegistroPeso p : pesos.findByAlunoIdOrderByDataAsc(alunoId)) {
            lista.add(new PesoResponse(p.getId(), p.getData(), p.getPesoKg(),
                    anterior == null ? null : p.getPesoKg().subtract(anterior), p.getObservacao()));
            anterior = p.getPesoKg();
        }
        Collections.reverse(lista);
        return lista;
    }

    /** Uma medida por dia: registrar de novo na mesma data substitui. */
    @Transactional
    @br.com.treinos.api.auditoria.Auditar(acao="PESO_REGISTRADO",entidade="PESO",resumo="Registrou ou alterou um peso.")
    public List<PesoResponse> registrar(UUID alunoId, PesoRequest r, UUID usuarioId) {
        exigirAluno(alunoId);
        if (r.data().isAfter(LocalDate.now(Fuso.BRASILIA))) {
            throw new BadRequestException("A data do peso não pode ser no futuro.");
        }
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

    private void exigirAluno(UUID alunoId) {
        Exigir.existe(alunos.findById(alunoId), () -> new NaoEncontradoException("Aluno não encontrado."));
    }
}
