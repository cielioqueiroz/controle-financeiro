const tbody = document.querySelector("tbody");
const descItem = document.querySelector("#desc");
const amount = document.querySelector("#amount");
const type = document.querySelector("#type");
const btnNew = document.querySelector("#btnNew");

const incomes = document.querySelector(".incomes");
const expenses = document.querySelector(".expenses");
const total = document.querySelector(".total");

let currentIndex = -1;

const getItensBD = () => JSON.parse(localStorage.getItem("db_items")) ?? [];
const setItensBD = () =>
  localStorage.setItem("db_items", JSON.stringify(items));

let items = getItensBD();

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  loadItens();
});

btnNew.onclick = () => {
  incluirItem();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    incluirItem();
  }
});

function incluirItem() {
  if (descItem.value === "" || amount.value === "" || type.value === "") {
    return Toastify({
      text: "Preencha todos os campos!",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#ff0000",
      className: "toastify",
    }).showToast();
  }

  const newItem = {
    desc: descItem.value,
    amount: parseFloat(amount.value),
    type: type.value,
  };

  if (currentIndex === -1) {
    items.push(newItem);
    Toastify({
      text: "Item incluído com sucesso!",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50",
      className: "toastify",
    }).showToast();
  } else {
    items[currentIndex] = newItem;
    currentIndex = -1;
    btnNew.textContent = "Incluir";
    Toastify({
      text: "Item editado com sucesso!",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50",
      className: "toastify",
    }).showToast();
  }

  setItensBD();
  loadItens();

  descItem.value = "";
  amount.value = "";
}

function deleteItem(index) {
  const item = items[index];
  showDeleteModal(item.desc, item.amount, index);
}

function editItem(index) {
  const item = items[index];
  showEditModal(item, index);
}

function showDeleteModal(desc, amount, index) {
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `
        <div class="modal-content">
            <p>Tem certeza que deseja excluir o item?</p>
            <p>Descrição: ${desc}</p>
            <p>Valor: ${amount.toLocaleString("pt-BR", {
              style: "currency",
              currency: "BRL",
            })}</p>
            <button id="confirmDelete">Sim</button>
            <button id="cancelDelete">Não</button>
        </div>
    `;
  document.body.appendChild(modal);

  document.getElementById("confirmDelete").onclick = () => {
    items.splice(index, 1);
    setItensBD();
    loadItens();
    modal.remove();
    Toastify({
      text: "Item excluído com sucesso!",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#ff0000",
      className: "toastify",
    }).showToast();
  };

  document.getElementById("cancelDelete").onclick = () => {
    modal.remove();
  };
}

function showEditModal(item, index) {
  const modal = document.createElement("div");
  modal.classList.add("modal");
  modal.innerHTML = `
        <div class="modal-content">
            <label for="editDesc">Descrição</label>
            <input type="text" id="editDesc" value="${item.desc}" />
            <label for="editAmount">Valor</label>
            <input type="number" id="editAmount" value="${item.amount}" />
            <label for="editType">Tipo</label>
            <select id="editType">
                <option ${
                  item.type === "Entrada" ? "selected" : ""
                }>Entrada</option>
                <option ${
                  item.type === "Saída" ? "selected" : ""
                }>Saída</option>
            </select>
            <button id="confirmEdit">Atualizar</button>
            <button id="cancelEdit">Cancelar</button>
        </div>
    `;
  document.body.appendChild(modal);

  document.getElementById("confirmEdit").onclick = () => {
    const editedItem = {
      desc: document.getElementById("editDesc").value,
      amount: parseFloat(document.getElementById("editAmount").value),
      type: document.getElementById("editType").value,
    };

    items[index] = editedItem;
    setItensBD();
    loadItens();
    modal.remove();
    Toastify({
      text: "Item atualizado com sucesso!",
      duration: 3000,
      gravity: "top",
      position: "right",
      backgroundColor: "#4caf50",
      className: "toastify",
    }).showToast();
  };

  document.getElementById("cancelEdit").onclick = () => {
    modal.remove();
  };
}

function insertItem(item, index) {
  let tr = document.createElement("tr");

  tr.innerHTML = `
        <td>${item.desc}</td>
        <td>${item.amount.toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
        })}</td>
        <td class="columnType">${
          item.type === "Entrada"
            ? '<i class="bx bxs-chevron-up-circle"></i>'
            : '<i class="bx bxs-chevron-down-circle"></i>'
        }</td>
        <td class="columnAction">
            <button onclick="editItem(${index})"><i class='bx bx-edit'></i></button>
            <button onclick="deleteItem(${index})"><i class='bx bx-trash'></i></button>
        </td>
    `;

  tbody.appendChild(tr);
}

function loadItens() {
  items = getItensBD();
  tbody.innerHTML = "";
  items.forEach((item, index) => {
    insertItem(item, index);
  });

  getTotals();
}

function getTotals() {
  const amountIncomes = items
    .filter((item) => item.type === "Entrada")
    .map((transaction) => Number(transaction.amount));

  const amountExpenses = items
    .filter((item) => item.type === "Saída")
    .map((transaction) => Number(transaction.amount));

  const totalIncomes = amountIncomes.reduce((acc, cur) => acc + cur, 0);

  const totalExpenses = Math.abs(
    amountExpenses.reduce((acc, cur) => acc + cur, 0)
  );

  const totalItems = totalIncomes - totalExpenses;

  incomes.innerHTML = totalIncomes.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  expenses.innerHTML = totalExpenses.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  total.innerHTML = totalItems.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

loadItens();
