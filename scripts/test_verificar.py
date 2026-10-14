"""Prova que CSP só pode medir o build produzido nesta execução."""
from contextlib import redirect_stdout
from io import StringIO
from subprocess import CompletedProcess
from unittest import TestCase
from unittest.mock import patch

from scripts import verificar


class VerificarTest(TestCase):
    def test_falha_no_build_impede_medicao_de_csp_e_retorna_erro(self):
        executados = []

        def rodar(cmd, **_kwargs):
            executados.append(cmd)
            if cmd == ['npm', 'run', 'build']:
                return CompletedProcess(cmd, 1, '', 'build simulado falhou')
            return CompletedProcess(cmd, 0, '', '')

        saida = StringIO()
        with patch.object(verificar.subprocess, 'run', side_effect=rodar), redirect_stdout(saida):
            codigo = verificar.main(rapido=False)

        self.assertEqual(codigo, 1)
        self.assertEqual(executados[-1], ['npm', 'run', 'build'])
        self.assertEqual(len(executados), len(verificar.PASSOS) - 1)
        self.assertIn('FALHOU: build', saida.getvalue())
        self.assertIn('build simulado falhou', saida.getvalue())
        self.assertNotIn('CSP (contra o build acima)', saida.getvalue())

    def test_csp_roda_depois_de_build_aprovado(self):
        executados = []

        def rodar(cmd, **_kwargs):
            executados.append(cmd)
            return CompletedProcess(cmd, 0, '', '')

        with patch.object(verificar.subprocess, 'run', side_effect=rodar), redirect_stdout(StringIO()):
            codigo = verificar.main(rapido=False)

        self.assertEqual(codigo, 0)
        self.assertEqual(executados, [cmd for _, cmd, _, _ in verificar.PASSOS])
