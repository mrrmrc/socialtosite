<?php
// api/services/profile_interview.php

require_once __DIR__ . '/ai.php';

class ProfileInterview {
    public static function reply(array $site, array $messages): array {
        // Prepare the conversation history
        $conversation = [];
        foreach (array_slice($messages, -20) as $message) {
            if (!is_array($message)) continue;
            $role = ($message['role'] ?? '') === 'ai' ? 'AI' : 'UTENTE';
            $text = trim((string)($message['text'] ?? ''));
            if ($text === '') continue;
            $conversation[] = $role . ': ' . mb_substr($text, 0, 1500);
        }

        $understanding = is_array($site['site_understanding'] ?? null) 
            ? $site['site_understanding'] 
            : json_decode((string)($site['site_understanding'] ?? ''), true) ?: [];

        $declared = is_array($site['declared_strategy'] ?? null) 
            ? $site['declared_strategy'] 
            : json_decode((string)($site['declared_strategy'] ?? ''), true) ?: [];

        $context = [
            'ai_deductions_from_social' => $understanding,
            'current_user_strategy_draft' => $declared
        ];

        $prompt = "Sei un Consulente Strategico di Marketing ed esperto di posizionamento. Il tuo compito è intervistare l'utente per estrarre e definire la sua 'Strategia Editoriale'.\n\n"
            . "REGOLE PER L'INTERVISTA:\n"
            . "1. Usa un tono professionale, empatico e curioso. Dai del 'tu'.\n"
            . "2. Fai SEMPRE E SOLO UNA DOMANDA alla volta. Non sommergere l'utente con troppe richieste.\n"
            . "3. Parti analizzando le deduzioni fatte dall'AI sui suoi social (vedi 'ai_deductions_from_social') e chiedi conferme o smentite.\n"
            . "4. L'obiettivo è riempire progressivamente il profilo strategico dell'utente. I campi da compilare sono:\n"
            . "   - activity_type (Cosa fa esattamente, es. 'Architetto d\'interni per uffici')\n"
            . "   - primary_goal (Obiettivo principale, es. 'Generare contatti B2B' o 'Educare il pubblico')\n"
            . "   - primary_audience (Target di riferimento, es. 'CEO di PMI', 'Giovani genitori')\n"
            . "   - tone_of_voice (Tono di voce desiderato: formale, provocatorio, accogliente, ecc.)\n"
            . "   - differentiators (Cosa lo rende unico rispetto ai competitor)\n"
            . "5. Quando hai raccolto informazioni sufficienti per aggiornare o compilare uno o più campi, devi restituire un blocco JSON ESATTO alla fine della tua risposta, dentro i tag ```json ... ```.\n"
            . "   Esempio: Grazie per il chiarimento! Quindi il tuo obiettivo principale è attrarre nuove startup, giusto? E con che tono vuoi parlarci? ```json\n"
            . "   {\"activity_type\": \"Avvocato per startup\", \"primary_audience\": \"Fondatori di startup tech\"}\n"
            . "   ```\n"
            . "   Il sistema intercetterà questo JSON e aggiornerà il database. Non mostrare questo JSON all'utente a parole, usalo solo nel blocco di codice.\n"
            . "6. Se la strategia (current_user_strategy_draft) è già ben popolata (almeno 3-4 campi pieni), puoi concludere l'intervista congratulandoti.\n\n"
            . "STATO ATTUALE (JSON):\n" . json_encode($context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n\n"
            . "CRONOLOGIA DELLA CHAT:\n" . implode("\n", $conversation) . "\n\n"
            . "Scrivi ora la TUA PROSSIMA RISPOSTA (e includi il blocco JSON alla fine se hai appena dedotto nuovi campi).";

        $reply = trim(AI::gemini([['text' => $prompt]], [
            'temperature' => 0.7,
            'maxOutputTokens' => 1500,
            '_timeout' => 45,
        ]));

        if ($reply === '') throw new Exception('Nessuna risposta dal modello AI.');

        // Extract JSON if present
        $updatedFields = [];
        $cleanReply = $reply;

        if (preg_match('/```json\s*(.*?)\s*```/s', $reply, $matches)) {
            $jsonString = trim($matches[1]);
            $parsed = json_decode($jsonString, true);
            if (is_array($parsed)) {
                $updatedFields = $parsed;
            }
            // Remove the json block from the user-facing text
            $cleanReply = trim(preg_replace('/```json\s*(.*?)\s*```/s', '', $reply));
        }

        return [
            'text' => $cleanReply,
            'updates' => $updatedFields
        ];
    }
}
