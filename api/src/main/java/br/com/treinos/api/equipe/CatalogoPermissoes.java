package br.com.treinos.api.equipe;
import br.com.plataforma.comum.web.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.LinkedHashSet;
import java.util.stream.Collectors;

/** Catálogo fixo; dependências validadas no servidor antes de gravar um perfil. */
public final class CatalogoPermissoes {
    private CatalogoPermissoes() { }
    public record Permissao(String codigo,String secao,String modulo,String descricao,boolean sensivel) { }
    public static final List<Permissao> CATALOGO=List.of(
        new Permissao("PAINEL_VER","Início","Painel","Ver: painel.",false),
        new Permissao("ALUNO_LER","Alunos","Cadastro","Consultar: cadastro.",false),
        new Permissao("ALUNO_ALTERAR","Alunos","Cadastro","Criar e editar: cadastro.",false),
        new Permissao("ALUNO_CONVITE","Alunos","Cadastro","Gerar convite: cadastro.",false),
        new Permissao("ALUNO_SENSIVEL_LER","Alunos","Dados sensíveis","Consultar: dados sensíveis.",true),
        new Permissao("ALUNO_SENSIVEL_ALTERAR","Alunos","Dados sensíveis","Criar e editar: dados sensíveis.",true),
        new Permissao("ALUNO_EXPORTAR","Alunos","Privacidade","Exportar: dados do aluno.",true),
        new Permissao("ALUNO_ANONIMIZAR","Alunos","Privacidade","Anonimizar: aluno que saiu.",true),
        new Permissao("REGISTRO_LER","Alunos","Registros","Consultar: registros.",false),
        new Permissao("INSCRICAO_LER","Alunos","Interessados","Consultar: interessados e link de inscrição.",false),
        new Permissao("INSCRICAO_ALTERAR","Alunos","Interessados","Atender, aceitar e recusar: interessados; configurar o link de inscrição.",false),
        new Permissao("PASTA_ALTERAR","Planos","Pastas","Criar e editar: pastas.",false),
        new Permissao("TREINO_LER","Planos","Treino","Consultar: treino.",false),
        new Permissao("TREINO_ALTERAR","Planos","Treino","Criar e editar: treino.",false),
        new Permissao("TREINO_PUBLICAR","Planos","Treino","Publicar versões: treino.",false),
        new Permissao("DIETA_LER","Planos","Dieta","Consultar: dieta.",false),
        new Permissao("DIETA_ALTERAR","Planos","Dieta","Criar e editar: dieta.",false),
        new Permissao("DIETA_PUBLICAR","Planos","Dieta","Publicar versões: dieta.",false),
        new Permissao("ATUALIZACAO_LER","Atualizações","Check-in","Consultar: check-in.",true),
        new Permissao("ATUALIZACAO_RESPONDER","Atualizações","Check-in","Enviar e editar feedback: check-in.",false),
        new Permissao("ANAMNESE_LER","Atualizações","Anamnese","Consultar: anamnese dos alunos.",true),
        new Permissao("ANAMNESE_ALTERAR","Atualizações","Anamnese","Enviar, dispensar e marcar revisada: anamnese dos alunos.",true),
        new Permissao("BIBLIOTECA_LER","Conteúdo","Biblioteca","Consultar: biblioteca.",false),
        new Permissao("BIBLIOTECA_ALTERAR","Conteúdo","Biblioteca","Criar e editar: biblioteca.",false),
        new Permissao("ERGOGENICO_LER","Conteúdo","Biblioteca","Consultar: medicação e ergogênicos.",true),
        new Permissao("ERGOGENICO_ALTERAR","Conteúdo","Biblioteca","Criar e editar: medicação e ergogênicos.",true),
        new Permissao("MODELO_LER","Conteúdo","Modelos","Consultar: modelos.",false),
        new Permissao("MODELO_ALTERAR","Conteúdo","Modelos","Criar e editar: modelos.",false),
        new Permissao("MODELO_APLICAR","Conteúdo","Modelos","Aplicar ao aluno: modelos.",false),
        new Permissao("QUESTIONARIO_LER","Conteúdo","Questionários","Consultar: questionários de atualização e de anamnese.",false),
        new Permissao("QUESTIONARIO_ALTERAR","Conteúdo","Questionários","Criar, editar e publicar: questionários de atualização e de anamnese.",false),
        new Permissao("MARCA_ALTERAR","Consultoria","Marca","Criar e editar: marca.",false),
        new Permissao("EQUIPE_LER","Consultoria","Equipe","Consultar: equipe.",false),
        new Permissao("USUARIO_ALTERAR","Consultoria","Equipe","Criar e editar: equipe.",false),
        new Permissao("PERFIL_ALTERAR","Consultoria","Equipe","Criar e editar: equipe.",false),
        new Permissao("AUDITORIA_LER","Consultoria","Auditoria","Consultar: auditoria.",false),
        new Permissao("CONTA_LER","Consultoria","Conta","Consultar: plano e cobranças.",false));
    public static final Set<String> CODIGOS=CATALOGO.stream().map(Permissao::codigo).collect(Collectors.toUnmodifiableSet());
    public static final Map<String,Set<String>> DEPENDENCIAS=Map.ofEntries(
        Map.entry("ALUNO_ALTERAR",Set.of("ALUNO_LER")),
        Map.entry("ALUNO_CONVITE",Set.of("ALUNO_LER")),
        Map.entry("ALUNO_SENSIVEL_LER",Set.of("ALUNO_LER")),
        Map.entry("ALUNO_SENSIVEL_ALTERAR",Set.of("ALUNO_SENSIVEL_LER")),
        Map.entry("ALUNO_EXPORTAR",Set.of("ALUNO_LER","ALUNO_SENSIVEL_LER")),
        Map.entry("ALUNO_ANONIMIZAR",Set.of("ALUNO_ALTERAR","ALUNO_SENSIVEL_ALTERAR")),
        Map.entry("PASTA_ALTERAR",Set.of("ALUNO_LER")),
        Map.entry("INSCRICAO_ALTERAR",Set.of("INSCRICAO_LER")),
        Map.entry("TREINO_ALTERAR",Set.of("TREINO_LER")),
        Map.entry("TREINO_PUBLICAR",Set.of("TREINO_LER","TREINO_ALTERAR")),
        Map.entry("DIETA_ALTERAR",Set.of("DIETA_LER")),
        Map.entry("DIETA_PUBLICAR",Set.of("DIETA_LER","DIETA_ALTERAR")),
        Map.entry("ATUALIZACAO_LER",Set.of("ALUNO_SENSIVEL_LER")),
        Map.entry("ATUALIZACAO_RESPONDER",Set.of("ATUALIZACAO_LER")),
        Map.entry("ANAMNESE_LER",Set.of("ALUNO_SENSIVEL_LER")),
        Map.entry("ANAMNESE_ALTERAR",Set.of("ANAMNESE_LER")),
        Map.entry("BIBLIOTECA_ALTERAR",Set.of("BIBLIOTECA_LER")),
        Map.entry("ERGOGENICO_LER",Set.of("BIBLIOTECA_LER")),
        Map.entry("ERGOGENICO_ALTERAR",Set.of("ERGOGENICO_LER")),
        Map.entry("MODELO_ALTERAR",Set.of("MODELO_LER")),
        Map.entry("MODELO_APLICAR",Set.of("MODELO_LER")),
        Map.entry("QUESTIONARIO_ALTERAR",Set.of("QUESTIONARIO_LER")),
        Map.entry("USUARIO_ALTERAR",Set.of("EQUIPE_LER")),
        Map.entry("PERFIL_ALTERAR",Set.of("EQUIPE_LER")));
    public static Set<String> validar(Set<String> codigos) {
        if(codigos==null || codigos.stream().anyMatch(java.util.Objects::isNull) || !CODIGOS.containsAll(codigos))
            throw new BadRequestException("Há permissões inválidas no perfil.");
        for(String codigo:codigos) if(!codigos.containsAll(DEPENDENCIAS.getOrDefault(codigo,Set.of())))
            throw new BadRequestException("Marque também as permissões necessárias para esta ação.");
        return Set.copyOf(codigos);
    }
    public static Set<String> comDependencias(Set<String> codigos) {
        var resultado=new LinkedHashSet<>(codigos);
        boolean mudou;
        do { int antes=resultado.size();
            for(String codigo:Set.copyOf(resultado)) resultado.addAll(DEPENDENCIAS.getOrDefault(codigo,Set.of()));
            mudou=antes!=resultado.size();
        } while(mudou);
        return Set.copyOf(resultado);
    }
}
