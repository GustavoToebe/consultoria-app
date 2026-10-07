package br.com.treinos.api.auth.dto;

import jakarta.validation.constraints.Size;

/** Só o cliente nativo manda o refresh no corpo; a web usa o cookie. */
public record RefreshRequest(@Size(max = 100) String refreshToken) {
}
