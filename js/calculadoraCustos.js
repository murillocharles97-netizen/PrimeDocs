const CalculadoraCustos = {
    calcular(entrada, config = Storage.carregarConfigCustos()) {
        const numero = valor => Math.max(0, Number(valor) || 0);
        const horasTotais = numero(entrada.horas) + (numero(entrada.minutos) / 60);
        const quantidade = Math.max(1, Math.floor(numero(entrada.quantidade) || 1));
        const pesoTotal = numero(entrada.pesoGramas) * quantidade;
        const precoKg = numero(entrada.precoKg || config.precoKgFilamentoPadrao);
        const materialBase = (precoKg / 1000) * pesoTotal;
        const material = materialBase * (1 + numero(config.perdaPercentual) / 100);
        const energia = horasTotais * numero(config.custoEnergiaHora);
        const depreciacao = horasTotais * numero(config.custoDepreciacaoHora);
        const maoDeObra = entrada.cobrarMaoDeObra
            ? horasTotais * numero(config.valorMaoDeObraHora)
            : numero(entrada.maoDeObra);
        const embalagem = numero(entrada.embalagem);
        const extras = numero(entrada.custoExtra);
        const subtotal = material + energia + depreciacao + maoDeObra + embalagem + extras;
        const imposto = subtotal * (numero(config.taxaImpostoPercentual) / 100);
        const custoTotal = subtotal + imposto;
        const margem = numero(entrada.margem);
        const precoSemDesconto = custoTotal * (1 + margem / 100);
        const precoSugerido = precoSemDesconto * (1 - Math.min(100, numero(entrada.desconto)) / 100);
        const lucroEstimado = precoSugerido - custoTotal;

        return {
            horasTotais,
            pesoTotal,
            material,
            energia,
            depreciacao,
            maoDeObra,
            embalagem,
            extras,
            subtotal,
            imposto,
            custoTotal,
            precoSugerido,
            lucroEstimado,
            lucroPorHora: horasTotais > 0 ? lucroEstimado / horasTotais : lucroEstimado
        };
    }
};
