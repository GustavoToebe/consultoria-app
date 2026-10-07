package br.com.treinos.api.auth;

import br.com.treinos.api.auth.dto.CadastroTreinadorRequest;
import br.com.treinos.api.consultoria.ConfiguracaoConsultoria;
import br.com.treinos.api.consultoria.Consultoria;
import br.com.treinos.api.consultoria.ConsultoriaRepository;
import br.com.treinos.api.web.ConflitoException;
import br.com.treinos.api.web.Emails;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.databind.json.JsonMapper;

import java.text.Normalizer;
import java.util.Locale;

/** Cria consultoria e treinador numa transação (só tabelas globais, sem {@code @TenantId}). Também usado pelo seed. */
@Service
public class CriacaoDeConta {

    private static final int SLUG_MAXIMO = 50;

    private final ConsultoriaRepository consultorias;
    private final UsuarioRepository usuarios;
    private final PasswordEncoder passwordEncoder;
    private final JsonMapper jsonMapper;

    public CriacaoDeConta(ConsultoriaRepository consultorias, UsuarioRepository usuarios,
                          PasswordEncoder passwordEncoder, JsonMapper jsonMapper) {
        this.consultorias = consultorias;
        this.usuarios = usuarios;
        this.passwordEncoder = passwordEncoder;
        this.jsonMapper = jsonMapper;
    }

    @Transactional
    public Usuario criarTreinador(CadastroTreinadorRequest request) {
        String email = Emails.normalizar(request.email());
        RegrasSenha.validar(request.senha(), email);
        if (usuarios.existeEmail(email)) {
            throw emailEmUso();
        }
        Consultoria consultoria = consultorias.save(new Consultoria(request.nomeConsultoria().trim(),
                slugUnico(request.nomeConsultoria()), jsonMapper.writeValueAsString(ConfiguracaoConsultoria.padrao())));
        try {
            return usuarios.saveAndFlush(Usuario.treinador(consultoria.getId(), email, request.nome().trim(),
                    passwordEncoder.encode(request.senha())));
        } catch (DataIntegrityViolationException corrida) {
            // Outro cadastro com o mesmo e-mail entrou entre a conferência e o insert.
            throw emailEmUso();
        }
    }

    private String slugUnico(String nome) {
        String base = slug(nome);
        String candidato = base;
        for (int n = 2; consultorias.existsBySlug(candidato); n++) {
            String sufixo = "-" + n;
            candidato = base.substring(0, Math.min(base.length(), SLUG_MAXIMO - sufixo.length())) + sufixo;
        }
        return candidato;
    }

    static String slug(String nome) {
        String semAcento = Normalizer.normalize(nome == null ? "" : nome, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        String slug = semAcento.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "-").replaceAll("(^-+|-+$)", "");
        if (slug.length() > SLUG_MAXIMO) {
            slug = slug.substring(0, SLUG_MAXIMO).replaceAll("-+$", "");
        }
        return slug.isEmpty() ? "consultoria" : slug;
    }

    static ConflitoException emailEmUso() {
        return new ConflitoException("Este e-mail já tem uma conta.", "EMAIL_EM_USO");
    }
}
