<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class ChangePasswordRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to change the target user's password.
     *
     * @return bool
     */
    public function authorize()
    {
        $target = $this->route('user');

        return $this->user() && $target && (int) $this->user()->id === (int) $target->id;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules()
    {
        return [
            'curPas' => ['required', 'string'],
            'newPas' => ['required', 'string', 'min:6'],
            'confirm' => ['required', 'same:newPas'],
        ];
    }
}
