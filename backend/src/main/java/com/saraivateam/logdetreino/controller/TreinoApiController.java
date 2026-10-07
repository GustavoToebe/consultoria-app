package com.saraivateam.logdetreino.controller;

import com.saraivateam.logdetreino.domain.DiaTreino;
import com.saraivateam.logdetreino.domain.LogExecucao;
import com.saraivateam.logdetreino.domain.PlanoTreino;
import com.saraivateam.logdetreino.dto.FichaExercicioDto;
import com.saraivateam.logdetreino.repository.LogExecucaoRepository;
import com.saraivateam.logdetreino.repository.PlanoTreinoRepository;
import com.saraivateam.logdetreino.service.CalculoCargaService;
import com.saraivateam.logdetreino.service.RelatorioPdfService;
import lombok.Data;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
@RequiredArgsConstructor
public class TreinoApiController {

    private final PlanoTreinoRepository planoTreinoRepository;
    private final LogExecucaoRepository logExecucaoRepository;
    private final CalculoCargaService calculoCargaService;
    private final RelatorioPdfService relatorioPdfService;

    @Data
    public static class CriarPlanoRequest {
        private String nome; // Ex: "Plano 16"
        private String dataInicio; // YYYY-MM-DD
        private String dataFim;    // YYYY-MM-DD
        private String observacao;
    }

    /**
     * Cria a "Pasta" do Plano de Treino e gera automaticamente os dias agendados
     * no período baseado no cronograma semanal do Saraiva Team
     */
    @PostMapping("/planos")
    public ResponseEntity<PlanoTreino> criarPlano(@RequestBody CriarPlanoRequest request) {
        LocalDate inicio = LocalDate.parse(request.getDataInicio());
        LocalDate fim = LocalDate.parse(request.getDataFim());

        PlanoTreino plano = PlanoTreino.builder()
                .nome(request.getNome())
                .dataInicio(inicio)
                .dataFim(fim)
                .observacao(request.getObservacao())
                .diasTreino(new ArrayList<>())
                .build();

        // Mapeia o cronograma semanal do Saraiva Team do PDF:
        // Seg: Costas | Ter: Peito+Ombro | Qua: Pernas | Qui: Off ativo | Sex: Upper | Sab: Pernas | Dom: Off ativo
        LocalDate atual = inicio;
        while (!atual.isAfter(fim)) {
            DayOfWeek dow = atual.getDayOfWeek();
            String divisao;
            boolean isOff = false;
            int cardio = 0;

            switch (dow) {
                case MONDAY -> divisao = "Costas (A1)";
                case TUESDAY -> divisao = "Peito + Ombros (A1/A2)";
                case WEDNESDAY -> divisao = "Pernas (B1)";
                case THURSDAY -> { divisao = "Off ativo"; isOff = true; cardio = 50; }
                case FRIDAY -> divisao = "Upper (A2/A3)";
                case SATURDAY -> divisao = "Pernas (B2/B3)";
                default -> { divisao = "Off ativo"; isOff = true; cardio = 50; }
            }

            DiaTreino dia = DiaTreino.builder()
                    .planoTreino(plano)
                    .dataAgendada(atual)
                    .diaSemana(dow.toString())
                    .divisao(divisao)
                    .isOff(isOff)
                    .cardioMin(cardio)
                    .build();

            plano.getDiasTreino().add(dia);
            atual = atual.plusDays(1);
        }

        PlanoTreino salvo = planoTreinoRepository.save(plano);
        return ResponseEntity.ok(salvo);
    }

    @GetMapping("/planos")
    public ResponseEntity<List<PlanoTreino>> listarPlanos() {
        return ResponseEntity.ok(planoTreinoRepository.findAll());
    }

    /**
     * Endpoint do CalculoCargaService:
     * Recebe um exercício (e opcionalmente a carga do WS), busca a última carga no Log
     * e devolve a ficha do dia montada com os pesos que devem ser colocados na barra/máquina.
     */
    @GetMapping("/exercicios/ficha-calculada")
    public ResponseEntity<FichaExercicioDto> obterFichaCalculada(
            @RequestParam String nomeExercicio,
            @RequestParam(defaultValue = "Costas") String categoria,
            @RequestParam(defaultValue = "false") boolean isLivre,
            @RequestParam(required = false) Double cargaWS,
            @RequestParam(defaultValue = "true") boolean temAquecimento,
            @RequestParam(defaultValue = "2") int feeders,
            @RequestParam(defaultValue = "2") int workingSets,
            @RequestParam(defaultValue = "false") boolean temTopSet,
            @RequestParam(defaultValue = "true") boolean temBackoff,
            @RequestParam(defaultValue = "0.85") double multBackoff
    ) {
        FichaExercicioDto ficha = calculoCargaService.montarFichaComCargas(
                nomeExercicio,
                categoria,
                isLivre,
                cargaWS,
                temAquecimento,
                feeders,
                workingSets,
                temTopSet,
                temBackoff,
                multBackoff
        );
        return ResponseEntity.ok(ficha);
    }

    /**
     * Endpoint de sincronização em lote de logs (Offline-first do mobile -> VPS)
     */
    @PostMapping("/logs/sync")
    public ResponseEntity<List<LogExecucao>> sincronizarLogs(@RequestBody List<LogExecucao> logs) {
        logs.forEach(l -> {
            if (l.getDataHoraExecucao() == null) {
                l.setDataHoraExecucao(LocalDateTime.now());
            }
            l.setValidada(true);
        });
        List<LogExecucao> salvos = logExecucaoRepository.saveAll(logs);
        return ResponseEntity.ok(salvos);
    }

    /**
     * Gera e baixa o PDF oficial com o histórico de cargas e evolução do período
     */
    @GetMapping("/planos/{planoId}/relatorio.pdf")
    public ResponseEntity<byte[]> baixarRelatorioPdf(@PathVariable Long planoId) {
        byte[] pdfBytes = relatorioPdfService.gerarRelatorioPeriodo(planoId);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_PDF);
        headers.setContentDispositionFormData("attachment", "relatorio-treino-plano-" + planoId + ".pdf");
        return ResponseEntity.ok().headers(headers).body(pdfBytes);
    }
}
