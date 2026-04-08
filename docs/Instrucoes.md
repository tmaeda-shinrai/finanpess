# O PROBLEMA

Atualmente utilizo uma planilha Google Sheets para fazer o controle de minhas finanças pessoais. Gostaria de elaborar um dashboard para visualização dos dados, com gráficos e tabelas, que seja acessível através de um link na internet. 

# A SOLUÇÃO

Elaborar um dashboard web que acesse os dados da planilha Google Sheets e exiba os dados em gráficos e tabelas. O dashboard deve ser acessível através de um link na internet e deve ser possível fazer login com uma conta Google para acessar os dados. O dashboard deve conter as despesas/receitas pagas e recebidas e os valores estimados, que são os valores que ainda estão com a coluna "Data" vazia.  

# REGRAS

1. O dashboard deve ser responsivo e funcionar em dispositivos móveis e desktops.
2. O dashboard deve ser acessível através de um link na internet.
3. O dashboard deve ser acessado apenas por quem tem acesso a planilha, já foi feita uma implementação semelhante veja o arquivo [text](guia_int_google.md) e implemente de forma semelhante.
4. Na tabela MOVIMENTACOES tem uma coluna chamada "Data" se a coluna estiver preenchida é porque a despesa/receita foi paga/recebida, se estiver vazia é porque ainda é "estimado".
5. Há dois tipos de caixas, o caixa "REGULAR" e o caixa "PARALELO", o caixa "REGULAR" é o caixa principal e o caixa "PARALELO" é um caixa extra, separe os dois no dashboard, mas mantenha a mesma lógica de separação. 

# FUNCIONALIDADES EXTRAS

Crie também um formulário para adicionar novas despesas e receitas, que deve ser acessível apenas por quem tem acesso a planilha. O formulário deve ser acessível através de um botão no dashboard.

No google sheets há a tabela MODELO que seriam as despesas/receitas que se repetem todo mês, gostaria no primeiro dia de cada mês, que o dashboard verificasse a tabela MODELO e adicionasse as despesas/receitas na tabela MOVIMENTACOES com a data do dia 1 do mês atual, mantendo a coluna "Data" vazia para que eu possa editar depois, e também alterasse a coluna "Parcela" para a próxima parcela, por exemplo, se a parcela for 24/240, na próxima vez que for adicionada na tabela MOVIMENTACOES, a parcela deve ser 25/240. Caso seja necessário alguma alteração na tabela MODELO, eu farei manualmente.