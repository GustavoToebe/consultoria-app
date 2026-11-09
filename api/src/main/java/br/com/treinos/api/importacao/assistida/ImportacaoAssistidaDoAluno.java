package br.com.treinos.api.importacao.assistida;

import br.com.treinos.api.importacao.assistida.ImportacaoAssistidaDtos.GrupoImportavel;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * A importação assistida para a privacidade: ao anonimizar o aluno (ou ele excluir a conta), o que as sessões em andamento
 * ainda guardam dele sai. Grupo ligado a ele ({@code alunoExistenteId}) vira esqueleto ignorado (sem nome, peso, treino
 * nem dieta) e ele deixa de aparecer como candidato nos outros grupos (o candidato leva o nome do cadastro). Os grupos já
 * importados já são esqueleto, e a sessão inteira some em 7 dias ({@link ImportacaoAssistidaRetencao}). Filtra em Java
 * sobre as sessões da consultoria (poucas, com prazo curto): sem SQL nativo. A exportação do aluno não leva as sessões:
 * são rascunho transitório de quem importa, sem vínculo estável com o aluno que a gravação cria.
 */
@Service
public class ImportacaoAssistidaDoAluno {

    private final ImportacaoSessaoRepository sessoes;
    private final JsonMapper json;

    public ImportacaoAssistidaDoAluno(ImportacaoSessaoRepository sessoes, JsonMapper json) {
        this.sessoes = sessoes;
        this.json = json;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void apagarDoAluno(UUID alunoId) {
        for (ImportacaoSessao sessao : sessoes.findAll()) {
            List<GrupoImportavel> grupos = SessaoJson.grupos(json, sessao);
            boolean mudou = false;
            List<GrupoImportavel> novos = new ArrayList<>();
            for (GrupoImportavel g : grupos) {
                if (alunoId.equals(g.alunoExistenteId())) {
                    novos.add(g.limpo("IGNORADO", "IGNORAR"));
                    mudou = true;
                } else if (g.candidatos() != null && g.candidatos().stream().anyMatch(c -> alunoId.equals(c.alunoId()))) {
                    novos.add(g.comCandidatos(g.candidatos().stream().filter(c -> !alunoId.equals(c.alunoId())).toList()));
                    mudou = true;
                } else {
                    novos.add(g);
                }
            }
            if (mudou) {
                SessaoJson.gravarGrupos(json, sessao, novos);
            }
        }
        sessoes.flush();
    }
}
