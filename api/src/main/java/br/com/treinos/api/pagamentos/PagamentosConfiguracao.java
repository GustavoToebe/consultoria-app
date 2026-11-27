package br.com.treinos.api.pagamentos;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties({PagamentosProperties.class, InfinitePayProperties.class, KiwifyProperties.class,
        AsaasProperties.class, LembretesProperties.class})
public class PagamentosConfiguracao implements WebMvcConfigurer {

    private final PagamentosInterceptor interceptor;

    PagamentosConfiguracao(PagamentosInterceptor interceptor, PagamentosProperties pagamentos,
                           InfinitePayProperties infinitePay, KiwifyProperties kiwify) {
        this(interceptor, pagamentos, infinitePay, kiwify,
                new AsaasProperties(false, null, null, null, null, null, null, false));
    }

    /** Com a InfinitePay, a Kiwify ou o Overtraining Pay ligados e variável faltando, a subida cai aqui (sem chamada de rede). */
    @Autowired
    public PagamentosConfiguracao(PagamentosInterceptor interceptor, PagamentosProperties pagamentos,
                                  InfinitePayProperties infinitePay, KiwifyProperties kiwify, AsaasProperties asaas) {
        infinitePay.exigirCompleta(pagamentos);
        kiwify.exigirCompleta(pagamentos, infinitePay);
        asaas.exigirCompleta(pagamentos, infinitePay);
        this.interceptor = interceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(interceptor);
    }
}
