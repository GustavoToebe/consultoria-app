package br.com.treinos.api.pagamentos;

import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties({PagamentosProperties.class, InfinitePayProperties.class})
public class PagamentosConfiguracao implements WebMvcConfigurer {

    private final PagamentosInterceptor interceptor;

    /** Com a InfinitePay ligada e variável faltando, a subida cai aqui (sem chamada de rede). */
    public PagamentosConfiguracao(PagamentosInterceptor interceptor, PagamentosProperties pagamentos,
                                  InfinitePayProperties infinitePay) {
        infinitePay.exigirCompleta(pagamentos);
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor);
    }
}
