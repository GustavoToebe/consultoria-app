package br.com.treinos.api.pagamentos;

import br.com.plataforma.comum.web.ConflictException;
import br.com.treinos.api.auditoria.Auditoria;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.FormasDeRecebimentoRequest;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.FormasDeRecebimentoResponse;
import br.com.treinos.api.pagamentos.FormasDeRecebimentoDtos.PixConfigRequest;
import br.com.treinos.api.tenant.TenantContext;
import br.com.treinos.api.web.ValidacaoException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** Regras do PUT das formas de recebimento sem banco: 422 por campo, versão, chave mantida, resposta sem a chave, auditoria. */
@ExtendWith(MockitoExtension.class)
class FormasDeRecebimentoServiceTest {

    private static final String EMAIL = "fulano@example.com";

    @Mock private FormasDeRecebimentoRepository repo;
    @Mock private Auditoria auditoria;
    private FormasDeRecebimentoService servico;
    private final UUID consultoria = UUID.randomUUID();

    @BeforeEach
    void preparar() {
        TenantContext.set(consultoria);
        servico = new FormasDeRecebimentoService(repo, auditoria);
    }

    @AfterEach
    void limpar() {
        TenantContext.clear();
    }

    private static FormasDeRecebimentoRequest corpo(boolean infinite, boolean link, boolean pix, boolean manual,
                                                    PixConfigRequest cfg, Long versao) {
        return new FormasDeRecebimentoRequest(infinite, link, pix, manual, cfg, versao);
    }

    private static PixConfigRequest email(String chave) {
        return new PixConfigRequest("EMAIL", chave, "Academia Teste", "Curitiba");
    }

    private FormasDeRecebimento gravada(boolean pix) {
        var f = new FormasDeRecebimento(consultoria, Instant.now());
        f.alterar(true, false, pix, new FormasDeRecebimento.DadosDoPix(ChavePix.Tipo.EMAIL, EMAIL, "Academia Teste", "Curitiba"),
                Instant.now());
        ReflectionTestUtils.setField(f, "versao", 3L); // o que o banco daria
        return f;
    }

    private ValidacaoException recusa(FormasDeRecebimentoRequest r) {
        return org.junit.jupiter.api.Assertions.assertThrows(ValidacaoException.class, () -> servico.salvar(r));
    }

    @Test
    void semLinhaOGetDevolveOPadraoESemCriarNada() {
        when(repo.daConsultoria()).thenReturn(Optional.empty());
        FormasDeRecebimentoResponse r = servico.obter();
        assertThat(r.infinitePay()).isTrue();
        assertThat(r.linkProprio()).isFalse();
        assertThat(r.pix()).isFalse();
        assertThat(r.manual()).isTrue();
        assertThat(r.pixConfig()).isNull();
        assertThat(r.versao()).isNull();
        verify(repo, never()).save(any());
        verify(repo, never()).saveAndFlush(any());
    }

    @Test
    void criaNaPrimeiraGravacaoComPixEAuditaComResumoFixo() {
        when(repo.daConsultoria()).thenReturn(Optional.empty());
        when(repo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        FormasDeRecebimentoResponse r = servico.salvar(corpo(false, true, true, true, email("Fulano@Example.com"), null));
        assertThat(r.pix()).isTrue();
        assertThat(r.linkProprio()).isTrue();
        assertThat(r.infinitePay()).isFalse();
        assertThat(r.pixConfig().chaveConfigurada()).isTrue();
        assertThat(r.pixConfig().chaveMascarada()).isEqualTo("f***@example.com");
        assertThat(r.toString()).doesNotContain(EMAIL);
        verify(auditoria).registrarEvento(eq("FORMAS_DE_RECEBIMENTO_CONFIGURADAS"), eq("FORMAS_DE_RECEBIMENTO"), eq(consultoria),
                eq("Configurou as formas de recebimento."));
    }

    @Test
    void pixLigadoExigePixConfigEManualNaoSeDesliga() {
        ValidacaoException e = recusa(corpo(true, false, true, false, null, null));
        assertThat(e.getCodigo()).isEqualTo("FORMAS_INVALIDAS");
        assertThat(e.getProblemas()).extracting("field").containsExactlyInAnyOrder("manual", "pixConfig");
        verify(repo, never()).saveAndFlush(any());
    }

    @Test
    void erroPorCampoNuncaRepeteOValorDigitado() {
        when(repo.daConsultoria()).thenReturn(Optional.empty());
        ValidacaoException e = recusa(corpo(true, false, true, true,
                new PixConfigRequest("EMAIL", "segredo-invalido", "N".repeat(26), " "), null));
        assertThat(e.getProblemas()).extracting("field")
                .containsExactlyInAnyOrder("pixConfig.chave", "pixConfig.nomeRecebedor", "pixConfig.cidade");
        assertThat(e.getProblemas().toString()).doesNotContain("segredo");
        ValidacaoException tipo = recusa(corpo(true, false, true, true, new PixConfigRequest("OUTRO", EMAIL, "A", "B"), null));
        assertThat(tipo.getProblemas()).extracting("field").containsExactly("pixConfig.tipoChave");
    }

    @Test
    void semChaveNovaMantemAGravadaSoComOMesmoTipo() {
        FormasDeRecebimento existente = gravada(true);
        when(repo.daConsultoria()).thenReturn(Optional.of(existente));
        when(repo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        servico.salvar(corpo(true, false, true, true, email(null), existente.getVersao()));
        assertThat(existente.dadosDoPix().chave()).isEqualTo(EMAIL);
        // A própria máscara que a tela mostrou também mantém.
        servico.salvar(corpo(true, false, true, true, email("f***@example.com"), existente.getVersao()));
        assertThat(existente.dadosDoPix().chave()).isEqualTo(EMAIL);
        // Trocar o tipo sem chave nova é 422 no campo da chave.
        ValidacaoException e = recusa(corpo(true, false, true, true,
                new PixConfigRequest("CPF", " ", "Academia Teste", "Curitiba"), existente.getVersao()));
        assertThat(e.getProblemas()).extracting("field").containsExactly("pixConfig.chave");
    }

    @Test
    void pixDesligadoSemPixConfigNaoApagaAConfiguracaoGravada() {
        FormasDeRecebimento existente = gravada(true);
        when(repo.daConsultoria()).thenReturn(Optional.of(existente));
        when(repo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        FormasDeRecebimentoResponse r = servico.salvar(corpo(true, false, false, true, null, existente.getVersao()));
        assertThat(r.pix()).isFalse();
        assertThat(r.pixConfig().chaveConfigurada()).isTrue();
        assertThat(existente.ligadas().pix()).isNull();
        assertThat(existente.dadosDoPix().chave()).isEqualTo(EMAIL);
    }

    @Test
    void versaoErradaOuAusenteEConflitoECriarComVersaoTambem() {
        when(repo.daConsultoria()).thenReturn(Optional.of(gravada(false)));
        assertThatThrownBy(() -> servico.salvar(corpo(true, false, false, true, null, null)))
                .isInstanceOfSatisfying(ConflictException.class, e -> assertThat(e.getCodigo()).isEqualTo("CONFLITO_EDICAO"));
        assertThatThrownBy(() -> servico.salvar(corpo(true, false, false, true, null, 99L)))
                .isInstanceOf(ConflictException.class);
        when(repo.daConsultoria()).thenReturn(Optional.empty());
        assertThatThrownBy(() -> servico.salvar(corpo(true, false, false, true, null, 0L)))
                .isInstanceOf(ConflictException.class);
        verify(repo, never()).saveAndFlush(any());
    }

    @Test
    void igualAoGravadoNaoAudita() {
        FormasDeRecebimento existente = gravada(true);
        // Mesmos valores que já estão gravados.
        when(repo.daConsultoria()).thenReturn(Optional.of(existente));
        when(repo.saveAndFlush(any())).thenAnswer(i -> i.getArgument(0));
        servico.salvar(corpo(true, false, true, true, email(null), existente.getVersao()));
        verify(auditoria, never()).registrarEvento(anyString(), anyString(), any(), anyString());
    }

    @Test
    void ligadasSemLinhaSaoOPadraoEComPixDesligadoNaoTrazPix() {
        when(repo.daConsultoria()).thenReturn(Optional.empty());
        assertThat(servico.ligadas()).isEqualTo(FormasDePagamentoDoAluno.Ligadas.PADRAO);
        when(repo.daConsultoria()).thenReturn(Optional.of(gravada(true)));
        assertThat(servico.ligadas().pix()).isNotNull();
        assertThat(servico.ligadas().pix().toString()).doesNotContain("fulano");
    }
}
