package br.com.treinos.api.cep;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.time.Clock;
import java.time.Duration;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Busca de CEP para preencher o endereço: confere os 8 dígitos, usa o ViaCEP e, se ele não responder, a BrasilAPI. Guarda
 * por um dia o que achou (o endereço de um CEP quase não muda e o serviço público agradece). CEP que o serviço diz não
 * existir é 404; serviços fora do ar, 503. O CEP nunca vai a log.
 */
@Service
public class CepService {

    private static final Duration VALIDADE = Duration.ofHours(24);
    private static final int CACHE_MAXIMO = 5_000;

    private record Guardado(EnderecoDoCep endereco, long ateMs) { }

    private final CepProperties propriedades;
    private final CepCliente cliente;
    private final Clock clock;
    private final Map<String, Guardado> cache = new ConcurrentHashMap<>();

    @Autowired
    CepService(CepProperties propriedades) {
        this(propriedades, new CepCliente(), Clock.systemUTC());
    }

    CepService(CepProperties propriedades, CepCliente cliente, Clock clock) {
        this.propriedades = propriedades;
        this.cliente = cliente;
        this.clock = clock;
    }

    public EnderecoDoCep buscar(String cepDigitado) {
        if (!propriedades.habilitado()) {
            throw CepException.indisponivel();
        }
        String cep = soDigitos(cepDigitado);
        if (cep.length() != 8) {
            throw CepException.invalido();
        }
        long agora = clock.millis();
        Guardado guardado = cache.get(cep);
        if (guardado != null && guardado.ateMs() > agora) {
            return guardado.endereco();
        }
        var resposta = cliente.consultar(propriedades.urlPrincipal(), cep);
        if (resposta.endereco().isEmpty() && !resposta.naoExiste()) {
            resposta = cliente.consultar(propriedades.urlReserva(), cep);
        }
        if (resposta.naoExiste()) {
            throw CepException.naoEncontrado();
        }
        EnderecoDoCep endereco = resposta.endereco().orElseThrow(CepException::indisponivel);
        if (cache.size() >= CACHE_MAXIMO) {
            cache.clear();
        }
        cache.put(cep, new Guardado(endereco, agora + VALIDADE.toMillis()));
        return endereco;
    }

    private static String soDigitos(String valor) {
        return valor == null ? "" : valor.replaceAll("\\D", "");
    }
}
