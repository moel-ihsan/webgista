<?php

namespace App\Http\Requests;

use App\Models\CctvPoint;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateTrafficConditionRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to update traffic conditions.
     *
     * @return bool
     */
    public function authorize()
    {
        return $this->user() && $this->user()->role === 'admin';
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, mixed>
     */
    public function rules()
    {
        return [
            'keterangan' => ['required', 'string', Rule::in(CctvPoint::ALLOWED_CONDITIONS)],
        ];
    }
}
