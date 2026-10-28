package br.com.treinos.api.alunos;

import br.com.plataforma.comum.web.ApiError;
import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.alunos.dto.AlunoDtos.Endereco;
import br.com.treinos.api.alunos.dto.MeusDadosRequest;
import br.com.treinos.api.alunos.dto.MeusDadosResponse;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.auth.Usuario;
import br.com.treinos.api.auth.UsuarioRepository;
import br.com.treinos.api.execucao.AlunoAppService;
import br.com.treinos.api.security.UsuarioAutenticado;
import br.com.treinos.api.web.Formatos;
import br.com.treinos.api.web.NaoEncontradoException;
import br.com.treinos.api.web.ValidacaoException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Objects;

/**
 * "Meus dados": o aluno confere e corrige o próprio cadastro (telefone, endereço, sexo e, se estiver vazio, o CPF). Sempre o
 * aluno da sessão. As regras são as do {@link AlunoService} (formatos, endereço "vazio ou completo", CPF único por
 * consultoria, telefone no usuário, sexo e ciclo); aqui só a composição. Nada é valor em auditoria, log ou mensagem de erro.
 *
 * <p>Inativo não é conferido aqui: inativar encerra as sessões e o filtro JWT só aceita usuário ativo (o aluno inativo recebe
 * 401 antes de chegar ao serviço). Anonimizado é 409 {@code ALUNO_ANONIMIZADO}.
 */
@Service
public class MeusDadosDoAlunoService {

    /** Resumo fixo: nunca o valor, nem o nome do campo que mudou. */
    static final String RESUMO = "O aluno atualizou os próprios dados cadastrais.";

    private final AlunoRepository alunos;
    private final UsuarioRepository usuarios;
    private final AlunoService alunoService;
    private final Auditoria auditoria;

    public MeusDadosDoAlunoService(AlunoRepository alunos, UsuarioRepository usuarios, AlunoService alunoService,
                                   Auditoria auditoria) {
        this.alunos = alunos;
        this.usuarios = usuarios;
        this.alunoService = alunoService;
        this.auditoria = auditoria;
    }

    @Transactional(readOnly = true)
    public MeusDadosResponse ler(UsuarioAutenticado eu) {
        Aluno aluno = alunos.findById(AlunoAppService.alunoDaSessao(eu)).orElseThrow(MeusDadosDoAlunoService::naoEncontrado);
        return resposta(aluno);
    }

    @Transactional
    public MeusDadosResponse alterar(UsuarioAutenticado eu, MeusDadosRequest r) {
        Aluno aluno = alunos.buscarParaAlterar(AlunoAppService.alunoDaSessao(eu)).orElseThrow(MeusDadosDoAlunoService::naoEncontrado);
        AlunoService.exigirNaoAnonimizado(aluno);
        if (r.versao() == null || !r.versao().equals(aluno.getVersao())) {
            throw AlunoService.conflitoDeEdicao();
        }

        // Todos os erros 422 juntos, como o PUT /alunos/{id}; mensagens fixas, nunca o valor enviado.
        var erros = new ArrayList<ApiError.FieldError>();
        String telefone = AlunoService.Dados.formato(erros, "telefone", Formatos::telefone, r.telefone());
        String cpf = AlunoService.Dados.formato(erros, "cpf", Formatos::cpf, r.cpf());
        Endereco endereco = AlunoService.Dados.endereco(erros, r.endereco());
        Sexo sexo = Sexo.ler(r.sexo());
        if (sexo == null && r.sexo() != null && !r.sexo().isBlank()) {
            erros.add(new ApiError.FieldError("sexo", AlunoService.SEXO_INVALIDO));
        }
        if (!erros.isEmpty()) {
            throw new ValidacaoException("Confira os seus dados.", "ALUNO_INVALIDO", erros);
        }

        // CPF: só preenche o que está vazio. Diferente do gravado, só o treinador corrige: com CPF já gravado o aluno nunca
        // recebe "em uso", então não testa CPFs de outras pessoas por aí. Cadastro vazio ainda responde ALUNO_CPF_EM_USO (é o
        // contrato) e, sem limite de tentativas, deixa testar um CPF por pedido. Igual = sem efeito.
        boolean mudaCpf = false;
        if (cpf != null) {
            if (aluno.getCpf() == null) {
                alunoService.exigirCpfLivre(cpf, aluno.getId());
                mudaCpf = true;
            } else if (!aluno.getCpf().equals(cpf)) {
                throw new ConflictException("O CPF já cadastrado só pode ser corrigido pelo seu treinador.",
                        "CPF_SO_PELO_TREINADOR");
            }
        }

        Usuario usuario = usuarioDe(aluno);
        boolean mudaTelefone = !Objects.equals(usuario == null ? null : usuario.getTelefone(), telefone);
        boolean mudaEndereco = !Objects.equals(aluno.endereco(), endereco);
        boolean mudaSexo = !Objects.equals(aluno.getSexo(), sexo);

        if (mudaTelefone) {
            alunoService.trocarTelefone(aluno, r.telefone() == null ? "" : r.telefone(), telefone);
        }
        if (mudaCpf) {
            aluno.alterarCpf(cpf);
        }
        if (mudaEndereco) {
            aluno.alterarEndereco(endereco);
        }
        if (mudaSexo) {
            alunoService.aplicarSexo(aluno, sexo == null ? null : sexo.name()); // desliga o ciclo se deixou de ser feminino
        }
        if (mudaTelefone || mudaCpf || mudaEndereco || mudaSexo) {
            aluno.tocar(); // a versão sobe mesmo quando só o telefone (que mora no usuário) mudou
            aluno = alunoService.gravar(aluno); // traduz a corrida do índice do CPF em 409 ALUNO_CPF_EM_USO
            auditoria.registrarEvento("ALUNO_DADOS_ALTERADOS_PELO_ALUNO", "ALUNO", aluno.getId(), RESUMO);
        }
        return resposta(aluno);
    }

    private MeusDadosResponse resposta(Aluno aluno) {
        return MeusDadosResponse.de(aluno, usuarioDe(aluno));
    }

    private Usuario usuarioDe(Aluno aluno) {
        return aluno.getUsuarioId() == null ? null : usuarios.findById(aluno.getUsuarioId()).orElse(null);
    }

    private static NaoEncontradoException naoEncontrado() {
        return new NaoEncontradoException("Aluno não encontrado.");
    }
}
