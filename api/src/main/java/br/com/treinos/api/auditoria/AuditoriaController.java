package br.com.treinos.api.auditoria;
import org.springframework.web.bind.annotation.*;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.format.annotation.DateTimeFormat;
import java.time.LocalDate;
import java.util.UUID;
@RestController
public class AuditoriaController {
    private final Auditoria auditoria;
    public AuditoriaController(Auditoria auditoria) { this.auditoria=auditoria; }
    @PreAuthorize("hasAuthority('PERM_AUDITORIA_LER')") @GetMapping("/auditoria")
    public Auditoria.Pagina listar(@RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate de,
                                  @RequestParam(required=false) @DateTimeFormat(iso=DateTimeFormat.ISO.DATE) LocalDate ate,
                                  @RequestParam(required=false) UUID usuarioId,@RequestParam(required=false) String acao,
                                  @RequestParam(defaultValue="0") int pagina) { return auditoria.listar(de,ate,usuarioId,acao,pagina); }
}
